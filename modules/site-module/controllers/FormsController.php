<?php

namespace modules\sitemodule\controllers;

use Craft;
use craft\elements\Entry;
use craft\web\Controller;
use craft\web\View;
use yii\web\BadRequestHttpException;
use yii\web\Response;

/**
 * Generic form handler.
 *
 * Handles front-end form submissions for any form defined in config/forms.php.
 * A form posts a hidden `form` param with its handle; this controller validates
 * the configured fields, optionally stores the submission as an entry and sends
 * an admin notification plus a customer confirmation mail.
 */
class FormsController extends Controller
{
    protected array|bool|int $allowAnonymous = true;

    public function actionSubmit(): ?Response
    {
        $this->requirePostRequest();
        $request = Craft::$app->getRequest();

        $handle = $request->getRequiredBodyParam('form');
        $forms = Craft::$app->getConfig()->getConfigFromFile('forms');

        if (!isset($forms[$handle])) {
            throw new BadRequestHttpException("Unknown form: {$handle}");
        }

        $def = $forms[$handle];

        // Honeypot: if a bot filled the hidden field, fake success and bail out.
        $honeypot = $def['honeypot'] ?? null;
        if ($honeypot && $request->getBodyParam($honeypot)) {
            return $this->succeed($def);
        }

        [$values, $errors] = $this->collectAndValidate($def, $request);

        if ($errors) {
            // Re-render the current page with the errors and the entered values.
            Craft::$app->getUrlManager()->setRouteParams([
                'formErrors' => $errors,
                'formValues' => $values,
                'formHandle' => $handle,
            ]);
            return null;
        }

        if (!empty($def['store'])) {
            $this->storeSubmission($def, $values);
        }

        $this->sendMails($def, $values);

        return $this->succeed($def);
    }

    private function collectAndValidate(array $def, $request): array
    {
        $values = [];
        $errors = [];

        foreach ($def['fields'] as $name => $field) {
            $value = $request->getBodyParam($name);
            if (is_string($value)) {
                $value = trim($value);
            }
            $values[$name] = $value;

            $isEmpty = ($value === null || $value === '' || $value === false || $value === []);

            if (($field['required'] ?? false) && $isEmpty) {
                $errors[$name] = ($field['label'] ?? $name) . ' wird benötigt.';
                continue;
            }

            if (!$isEmpty && ($field['type'] ?? null) === 'email' && !filter_var($value, FILTER_VALIDATE_EMAIL)) {
                $errors[$name] = 'Bitte gib eine gültige E-Mail-Adresse an.';
            }
        }

        return [$values, $errors];
    }

    private function storeSubmission(array $def, array $values): void
    {
        $section = Craft::$app->getEntries()->getSectionByHandle($def['store']);
        if (!$section) {
            return;
        }

        $entryType = $section->getEntryTypes()[0] ?? null;
        if (!$entryType) {
            return;
        }

        $name = $values[$def['customer']['nameField'] ?? 'name'] ?? '';

        $entry = new Entry();
        $entry->sectionId = $section->id;
        $entry->typeId = $entryType->id;
        $entry->title = sprintf(
            '%s - %s - %s',
            $def['name'] ?? 'Anfrage',
            $name !== '' ? $name : 'Unbekannt',
            date('d.m.Y H:i')
        );
        $entry->setFieldValues([
            'formName' => $def['name'] ?? '',
            'senderEmail' => $values[$def['customer']['emailField'] ?? 'email'] ?? '',
            'submissionData' => $this->summarize($def, $values),
        ]);

        Craft::$app->getElements()->saveElement($entry);
    }

    private function sendMails(array $def, array $values): void
    {
        $mailer = Craft::$app->getMailer();
        $view = Craft::$app->getView();
        $summary = $this->summarize($def, $values);

        $customerEmail = $values[$def['customer']['emailField'] ?? 'email'] ?? null;

        // Notification to the team.
        if (!empty($def['admin']['recipients'])) {
            $adminBody = $view->renderTemplate($def['admin']['template'], [
                'def' => $def,
                'values' => $values,
                'summary' => $summary,
            ], View::TEMPLATE_MODE_SITE);

            $message = $mailer->compose()
                ->setTo($def['admin']['recipients'])
                ->setSubject($def['admin']['subject'])
                ->setHtmlBody($adminBody);

            if ($customerEmail) {
                $message->setReplyTo($customerEmail);
            }

            $message->send();
        }

        // Confirmation to the customer.
        if ($customerEmail && !empty($def['customer']['template'])) {
            $customerBody = $view->renderTemplate($def['customer']['template'], [
                'def' => $def,
                'values' => $values,
                'name' => $values[$def['customer']['nameField'] ?? 'name'] ?? '',
                'summary' => $summary,
            ], View::TEMPLATE_MODE_SITE);

            $mailer->compose()
                ->setTo($customerEmail)
                ->setSubject($def['customer']['subject'])
                ->setHtmlBody($customerBody)
                ->send();
        }
    }

    private function summarize(array $def, array $values): string
    {
        $lines = [];

        foreach ($def['fields'] as $name => $field) {
            // Felder, die explizit von der Übersicht ausgenommen sind (z. B.
            // strukturierte Rohdaten wie stopsData), überspringen.
            if (($field['summary'] ?? true) === false) {
                continue;
            }

            $value = $values[$name] ?? '';

            if ($value === '' || $value === null || $value === []) {
                continue;
            }

            if (!empty($field['boolean'])) {
                $value = 'Ja';
            }

            $lines[] = ($field['label'] ?? $name) . ': ' . (is_array($value) ? implode(', ', $value) : $value);
        }

        return implode("\n", $lines);
    }

    private function succeed(array $def): Response
    {
        Craft::$app->getSession()->setFlash(
            'formSuccess',
            $def['successMessage'] ?? 'Danke für deine Anfrage!'
        );

        return $this->redirectToPostedUrl();
    }
}
