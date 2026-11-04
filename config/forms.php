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
            'portions' => ['label' => 'Portionen pro Tag', 'required' => true],
            'startDate' => ['label' => 'Wunsch-Startdatum', 'required' => true, 'type' => 'date'],
            'deliveryWindow' => [
                'label' => 'Bevorzugter Lieferzeitraum',
                'required' => true,
                'options' => ['11:30-13:00', '12:30-14:00'],
            ],
            'recipient' => [
                'label' => 'Für wen',
                'required' => true,
                'requiredMessage' => 'Bitte wähle, für wen das Wochenbett-Wunder ist.',
                // Submitted value => what mails and the CMS show.
                'options' => [
                    'Für mich' => 'Für mich, Lieferung an die Rechnungsanschrift',
                    'Für eine andere Person' => 'Für eine andere Person, Lieferung siehe "Lieferung an"',
                ],
            ],
            // Die bestellende Person. Ihre Anschrift ist die Rechnungsadresse und,
            // wenn sie für sich selbst bestellt, auch die Lieferadresse.
            'name' => ['label' => 'Name', 'required' => true],
            'email' => ['label' => 'E-Mail', 'required' => true, 'type' => 'email'],
            'phone' => ['label' => 'Telefon', 'required' => true],
            'street' => ['label' => 'Rechnungsanschrift (Straße & Hausnummer)', 'required' => true],
            'zip' => ['label' => 'Rechnungsanschrift (PLZ)', 'required' => true],
            'city' => ['label' => 'Rechnungsanschrift (Ort)', 'required' => true],
            // Nur erfasst und Pflicht, wenn für eine andere Person bestellt wird.
            'deliveryName' => ['label' => 'Lieferung an (Name)', 'required' => true, 'dependsOn' => ['recipient' => 'Für eine andere Person']],
            'deliveryPhone' => ['label' => 'Lieferung an (Telefon)', 'required' => false, 'dependsOn' => ['recipient' => 'Für eine andere Person']],
            'deliveryStreet' => ['label' => 'Lieferung an (Straße & Hausnummer)', 'required' => true, 'dependsOn' => ['recipient' => 'Für eine andere Person']],
            'deliveryZip' => ['label' => 'Lieferung an (PLZ)', 'required' => true, 'dependsOn' => ['recipient' => 'Für eine andere Person']],
            'deliveryCity' => ['label' => 'Lieferung an (Ort)', 'required' => true, 'dependsOn' => ['recipient' => 'Für eine andere Person']],
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

    'delivery' => [
        'name' => 'Lieferanfrage',
        'honeypot' => 'website',
        'fields' => [
            // Aus dem Preisrechner übernommen (per JS in Hidden-Felder gefüllt)
            'deliveryTime' => ['label' => 'Zustellzeit', 'required' => true],
            'estimatedTotal' => ['label' => 'Geschätzter Gesamtpreis', 'required' => false],
            // Menschenlesbarer Route-Block (Abholung + Stops mit Gebiet/Gewicht/Preis/Adresse)
            'stops' => ['label' => 'Route (Abholung & Stops)', 'required' => true],
            // Strukturierte Rohdaten für Rehydrierung/Weiterverarbeitung - nicht in Mail/Übersicht
            'stopsData' => ['label' => 'Stops (Rohdaten)', 'required' => false, 'summary' => false],
            // Kundendaten
            'name' => ['label' => 'Name', 'required' => true],
            'email' => ['label' => 'E-Mail', 'required' => true, 'type' => 'email'],
            'phone' => ['label' => 'Telefon', 'required' => true],
            // Rechnungsanschrift
            'company' => ['label' => 'Firma', 'required' => false],
            'billingStreet' => ['label' => 'Rechnungsanschrift - Straße & Hausnummer', 'required' => true],
            'billingZip' => ['label' => 'PLZ', 'required' => true],
            'billingCity' => ['label' => 'Ort', 'required' => true],
            'notes' => ['label' => 'Nachricht', 'required' => false],
            'privacy' => ['label' => 'Datenschutz akzeptiert', 'required' => true, 'boolean' => true],
        ],
        'store' => 'submissions',
        'admin' => [
            'recipients' => ['auftrag@cykelbu.de'],
            'subject' => 'Neue Lieferanfrage',
            'template' => '_emails/delivery-admin',
        ],
        'customer' => [
            'subject' => 'Danke für deine Lieferanfrage',
            'template' => '_emails/delivery-customer',
            'emailField' => 'email',
            'nameField' => 'name',
        ],
        'successMessage' => 'Danke für deine Anfrage! Der angezeigte Preis ist eine unverbindliche Schätzung - wir prüfen deine Angaben (Adressen, Gebiete, Gewichte) und melden uns persönlich mit dem exakten Preis und dem weiteren Ablauf.',
    ],
];
