# Privacy Notice and Terms of Use: review notes

The texts in `src/app/legal.ts` were written from how the site actually works, not by a lawyer. This
document is for the person who signs them off. It lists what the site really does with personal
information (so the notice can be checked against it) and the decisions that need a qualified person.
It is not legal advice.

## What the site does with personal information

| Information                                                             | Where it lives                                                                                 | Who can see it                                                                                             | Removed by "Delete my account"                             |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Name, email, phone                                                      | Database (users)                                                                               | The customer; admin; a courier sees name, phone and address of an order only after accepting that delivery | Yes                                                        |
| Password                                                                | Database, salted scrypt hash                                                                   | Nobody (never shown)                                                                                       | Yes                                                        |
| Profile picture                                                         | Database, with the user                                                                        | The user                                                                                                   | Yes                                                        |
| Sign-in tokens                                                          | Database (hashed); the browser (localStorage if "Keep me signed in", otherwise sessionStorage) | The user                                                                                                   | Yes (database); the browser copy is removed on sign-out    |
| Terms acceptance (time and version)                                     | Database, with the user                                                                        | Admin (database)                                                                                           | Yes                                                        |
| Orders: items, date/time, notes, recipient names, payment method, total | Database (orders)                                                                              | The customer, admin, the assigned courier                                                                  | Orders are **kept**; notes and recipient names are removed |
| Orders: name, phone, delivery address and coordinates                   | Database (orders)                                                                              | Admin, the assigned courier                                                                                | Removed from kept orders                                   |
| Order history: each status and when it happened                         | Database (orders)                                                                              | The customer sees status and time; admin also sees who                                                     | Customer's id replaced by a fixed label                    |
| Basket, welcome-screen flag                                             | The browser (localStorage)                                                                     | The user                                                                                                   | Not applicable (never sent to us)                          |
| Device location                                                         | Sent once with a delivery order; used to check the 5 km area                                   | Admin, the assigned courier                                                                                | Removed from kept orders                                   |

Third parties that receive information: the website host (Netlify), the server host (Render), the
database host, the email service (Resend: the customer's email address and the message), and the image
host (Cloudinary: product pictures only, never customer information). The shop's own address is sent to
OpenStreetMap's search when an admin saves a new address in Settings; no customer data is sent there.

Emails sent: order received, each status change (including automatic cancellation), password reset,
account deleted, and a new-order message to the shop.

## Decisions for a qualified person

1. **Responsible party and Information Officer.** The notice names the shop as the responsible party. Is an
   Information Officer registered with the Information Regulator, and should the notice name them?
2. **Retention of orders.** Orders are kept after deletion with personal details removed. How long must
   accounting records be kept for this business, and should that period be stated?
3. **Cross-border transfers.** Some providers process information outside South Africa (POPIA section 72).
   Is the wording ("we choose providers that protect it") enough, or are written agreements needed?
4. **Consent wording and records.** Registration needs an explicit tick; the time and the version of the
   texts are stored. Is that sufficient evidence, and should existing accounts be asked to re-accept after
   a change (today the version is only recorded at registration)?
5. **Consumer Protection Act.** Terms say only the shop can change or cancel an order, nothing is paid
   in advance, and orders not completed within a working day are cancelled automatically. Do these fit
   the CPA's rules on cancellation and on pre-ordered goods?
6. **Allergen wording** and the limitation of liability clause.
7. **Children.** The notice says the service is for adults.
8. **Breach notification.** The notice promises to tell the Information Regulator and affected people. Is
   there a process to do that?
9. **Marketing.** None is sent. If that ever changes, POPIA section 69 rules apply.

When the wording changes, update `LEGAL_UPDATED` in `src/app/legal.ts` and `TERMS_VERSION` in the API
(`src/terms.ts`) together.
