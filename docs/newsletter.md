# Newsletter - Anbindung an externen Dienst

## Ziel

Newsletter-Versand über einen externen Dienst auslagern, aber im Craft-Frontend
ein eigenes Anmeldeformular im Seitendesign anbieten. Geringes Volumen erwartet
(wenige Abonnenten).

## Ausgangslage im Projekt

- Kein Form-Plugin installiert (kein Formie, kein Freeform).
- Formulare werden manuell in Twig gebaut.
- Kein eigener Versand/Server gewünscht - Zustellbarkeit, Double-Opt-in,
  Abmeldung und Bounce-Handling soll der Dienst übernehmen.

## Entscheidung: Dienst

**MailerLite (Bezahltarif)** als Empfehlung.

- Einstiegstarif ca. **9-10 EUR/Monat** (jährlich gezahlt) fuer bis zu
  **500 Abonnenten** - bei unserem Volumen die kleinste Stufe.
- Gegenüber dem Free-Tier: kein MailerLite-Branding, unbegrenzt Mails, volle
  Automations, mehrere Nutzer, besserer Support, sauberer AV-Vertrag.
- Bestes Preis-Leistungs-Verhältnis und angenehmste Bedienung.

Preise ändern sich gelegentlich - vor Abschluss auf der Anbieterseite gegenchecken.

### Geprüfte Alternativen

| Anbieter        | Hosting     | Free-Tier                     | Bezahlt (Einstieg)        | Hinweis                                  |
|-----------------|-------------|-------------------------------|---------------------------|------------------------------------------|
| **MailerLite**  | US (DSGVO)  | 1.000 Kontakte / 12.000 Mails | ~9-10 EUR/Mo, 500 Kontakte| Beste UX, Empfehlung                     |
| EmailOctopus    | UK (AWS EU) | 2.500 Kontakte / 10.000 Mails | ~8 EUR/Mo, 500 Kontakte   | Etwas günstiger, schlichter              |
| Brevo           | EU (FR)     | 300 Mails/Tag, unbegr. Kontakte| ~7-9 EUR/Mo               | Wenn EU-Hosting Pflicht                  |
| Mailjet         | EU (FR)     | 6.000 Mails/Mo (200/Tag)      | ~15 EUR/Mo                | EU-Alternative zu Brevo                  |
| CleverReach     | DE/EU       | 250 Kontakte / 1.000 Mails/Mo | höher                     | Deutscher Anbieter, alles auf Deutsch    |
| Kit (ConvertKit)| US          | bis 10.000 Abonnenten         | -                         | Eher Creator/Automations, überdimensioniert |
| Mailchimp       | US          | 500 Kontakte                  | teuer                     | Gemieden: teuer, DSGVO umständlich       |

### Verworfene Ansätze

- **Formie/Freeform installieren** nur für ein Newsletter-Feld - Overkill, da
  Formulare ohnehin manuell gebaut werden.
- **Self-hosted** (Craft Campaign oder listmonk) - verlagert Versand,
  Zustellbarkeit, DKIM/SPF/DMARC und Wartung zurück zu uns.
- **Scaleway (Transactional Email)** - nur ein Mail-Versand-Backend, kein
  Newsletter-Tool (keine Listen, kein Opt-in, keine Formulare). Nur sinnvoll in
  Kombination mit self-hosted listmonk - für unser Volumen der falsche Hebel.

## Integrationsweg (Frontend)

Die Frontend-Anbindung ist bei allen Diensten identisch - alle bieten
Embed-Formular + API. Zwei Varianten:

### Variante A - ohne Backend-Code

Eigenes Twig-Formular im Design, das direkt an das Embed-Form-Endpoint des
Anbieters postet. Double-Opt-in + Bestätigungsseite übernimmt der Anbieter.
Null Wartung, aber Redirect auf deren Danke-Seite und weniger Kontrolle über
Fehlerhandling.

### Variante B - kleiner Craft-Controller (empfohlen)

Eigenes Twig-Formular -> POST auf eine eigene Route in einem Craft-Modul ->
API-Call an den Anbieter (`POST /contacts`), der die Adresse mit Status
"Double-Opt-in pending" anlegt. Der Anbieter verschickt die Bestätigungsmail.

Vorteile:

- Formular bleibt komplett im eigenen Design.
- Saubere Erfolgs-/Fehlermeldung inline.
- Honeypot + CSRF über Craft.
- API-Key nur serverseitig (in `.env`).

Aufwand: ein Controller mit einem `Craft::createGuzzleClient()`-Call.

## Nächste Schritte

1. MailerLite-Account anlegen, Kontaktliste erstellen, Double-Opt-in aktivieren.
2. API-Key erzeugen und in `.env` ablegen.
3. Variante B umsetzen: Craft-Modul mit Route + Controller, Twig-Partial fürs
   Formular (Honeypot, CSRF, inline Validierung).
