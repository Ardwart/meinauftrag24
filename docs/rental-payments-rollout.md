# Fahrzeugbuchungen – sichere Freischaltung (MeinAuftrag24.ch)

## Stand 21.11.2026
- 10 % Vermittlungsprovision, serverseitig berechnet und per Datenbankbedingung gesichert; 90 % Vermieteranteil **vor** Zahlungsanbietergebühren.
- Separate Buchungstabellen und Stripe-Connect-Auszahlungskonten. Bestehende Abonnements, Preise und Webhooks bleiben unverändert.
- Gäste buchen ohne Kundenlogin; Stripe Checkout zeigt TWINT (bis CHF 5'000, falls aktiviert) und Kreditkarten.
- Zahlung gilt nur nach verifiziertem Stripe-Webhook und Status `payment_status=paid` als bestätigt.
- Datenbank verhindert überlappende Buchungen; wartende Checkout-Reservierungen verfallen.
- Zahlungsbestätigung wird per Resend an Kunde und Anbieter geschickt, sofern `RESEND_API_KEY` vorhanden ist.
- **Zahlungen sind nicht freigeschaltet:** `RENTAL_PAYMENTS_ENABLED` muss nach den Tests ausdrücklich auf `true` gesetzt werden.

## Bereits auf Supabase installiert
Neue Datenbankobjekte: `rental_payout_accounts`, `rental_bookings`, `rental_reserve_booking`, `rental_busy_vehicle_ids`.
Neue Edge Functions: `rental-connect`, `rental-checkout`, `rental-webhook`, `rental-status`.
Die bisherige Live-Abonnementfunktion `stripe-live-webhook` wurde nicht verändert.

## Sichere Aktivierung
1. Unter Stripe Connect prüfen, ob Express-Connected-Accounts, Destination Charges und TWINT für die Schweizer Plattform aktiviert werden können. Rechtliche Rolle der Plattform, Rückerstattungen, Versicherungen, AGB, Steuern und Chargebacks klären.
2. Im **Testmodus** in Supabase Edge Functions Secrets `STRIPE_RENTAL_SECRET_KEY` auf den zugehörigen Stripe-Testschlüssel setzen. `RENTAL_PAYMENTS_ENABLED` zunächst deaktiviert lassen. **Keine geheimen Schlüssel in GitHub oder Chat einfügen.**
3. Neuen Stripe-Test-Webhook registrieren: `https://ucdcpjnkdfcahlpsbcjy.supabase.co/functions/v1/rental-webhook`. Ereignisse: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`. Das **separate** Signing Secret als `STRIPE_RENTAL_WEBHOOK_SECRET` setzen; nicht den bestehenden Abo-Webhook umstellen.
4. Resend-Sendeadresse `support@meinauftrag24.ch` und `RESEND_API_KEY` prüfen. Danach Testaccount eines Vermieters anbinden und Testbuchung inklusive E-Mail-Bestätigung überprüfen.
5. Rate-Limiting/Anti-Spam für Gastbuchungen einrichten, bevor öffentliche kostenpflichtige Buchungen aktiviert werden.
6. Nach erfolgreichen Sandbox-Tests Live-Schlüssel, eigenen Live-Webhook und Stripe-Connect-Onboarding für echte Vermieter einrichten. TWINT im Stripe-Dashboard aktivieren und die verlangten Schweizer Impressums-/AGB-Angaben prüfen.
7. Den geprüften GitHub-Änderungszweig mit `main` zusammenführen, Vercel-Produktionsdeployment und Such-/Buchungsoberfläche testen. Bestehende Abos (CHF 39/79) verifizieren.
8. **Erst dann** `RENTAL_PAYMENTS_ENABLED=true` setzen und eine kleine reale Buchung mit einem eigenen Fahrzeug überwacht testen. Anschliessend Buchung, 10-%-Provision, 90-%-Transfer, E-Mails und Erstattungsablauf prüfen.

## Risikohinweise
- Bei Stripe Connect Destination Charges ist die Plattform Merchant of Record und trägt grundsätzlich Stripe-Gebühren sowie bestimmte Rückerstattungs-/Dispute-Risiken. Die genannten 10 % sind eine Brutto-Provision.
- Fahrzeughalter erhalten ihr Geld über den Stripe-Auszahlungszyklus, nicht unmittelbar als Banküberweisung beim Checkout.
- Für Gäste funktioniert die Bestätigung nach Zahlung ohne Login, der Vermieter hat im eigenen Konto Einblick in Buchungen.
- Belegte Zeitfenster werden in der Suche ausgefiltert; der Datenbank-Constraint ist die verbindliche Schranke.
- Noch kein automatisierter Storno-/Kautionsprozess. Vor einer grossen öffentlichen Freischaltung separat prüfen.
