<?php

/**
 * Form definitions for the generic form handler (modules\sitemodule\controllers\FormsController).
 *
 * Add a new form by adding a new entry here and creating a matching front-end
 * partial at templates/_partials/forms/<handle>.twig plus the referenced email
 * templates. No plugin required.
 *
 * Per form:
 *   name           Human readable name (used in mails and stored submissions)
 *   honeypot       Name of the hidden anti-spam field rendered in the form
 *   fields         Map of fieldName => [label, required, type] (type 'email' is validated)
 *   store          Optional section handle to save each submission as an entry
 *   admin          recipients[], subject, template (Twig path) for the team mail
 *   customer       subject, template, emailField, nameField for the confirmation mail
 *   successMessage Flash message shown after a successful submission
 */

return [
    'wochenbett' => [
        'name' => 'Wochenbett-Wunder Anfrage',
        'honeypot' => 'website',
        'fields' => [
            'variant' => ['label' => 'Ernährungsform', 'required' => true],
            'startDate' => ['label' => 'Wunsch-Startdatum', 'required' => true],
            'portions' => ['label' => 'Portionen pro Tag', 'required' => true],
            'name' => ['label' => 'Name', 'required' => true],
            'email' => ['label' => 'E-Mail', 'required' => true, 'type' => 'email'],
            'phone' => ['label' => 'Telefon', 'required' => true],
            'street' => ['label' => 'Straße & Hausnummer', 'required' => true],
            'zip' => ['label' => 'PLZ', 'required' => true],
            'city' => ['label' => 'Ort', 'required' => true],
            'gift' => ['label' => 'Ist ein Geschenk', 'required' => false, 'boolean' => true],
            'giftName' => ['label' => 'Name der/des Beschenkten', 'required' => false],
            'notes' => ['label' => 'Allergien / Nachricht', 'required' => false],
            'privacy' => ['label' => 'Datenschutz akzeptiert', 'required' => true, 'boolean' => true],
        ],
        'store' => 'submissions',
        'admin' => [
            'recipients' => ['auftrag@cykelbu.de'],
            'subject' => 'Neue Wochenbett-Wunder Anfrage',
            'template' => '_emails/wochenbett-admin',
        ],
        'customer' => [
            'subject' => 'Danke für deine Wochenbett-Wunder Anfrage',
            'template' => '_emails/wochenbett-customer',
            'emailField' => 'email',
            'nameField' => 'name',
        ],
        'successMessage' => 'Vielen Dank für deine Anfrage! Wir haben sie erhalten und melden uns persönlich bei dir - mit allen Infos zur Bezahlung (Überweisung oder PayPal) und dem weiteren Ablauf.',
    ],
];
