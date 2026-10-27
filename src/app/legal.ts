/** The shop's details the legal pages quote, taken from the live settings so they stay correct. */
export type ShopInfo = { storeName: string; address: string; supportEmail: string };
export type LegalSection = { heading: string; paragraphs?: string[]; bullets?: string[] };

/** Shown at the top of both pages; change it together with TERMS_VERSION in royal-treats-api. */
export const LEGAL_UPDATED = '27 October 2026';

const contact = (shop: ShopInfo) =>
  shop.supportEmail.trim()
    ? `email us at ${shop.supportEmail.trim()} or use the Contact page`
    : 'use the Contact page';

/** The privacy notice, written for the Protection of Personal Information Act (POPIA). */
export function privacySections(shop: ShopInfo): LegalSection[] {
  return [
    {
      heading: 'Who we are',
      paragraphs: [
        `${shop.storeName} (“we”, “us”), ${shop.address}, is the responsible party under the Protection of Personal Information Act, 2013 (POPIA) for the personal information described in this notice. If you have a question or request about your information, ${contact(shop)}.`,
      ],
    },
    {
      heading: 'What we collect',
      bullets: [
        'Your account: your name, email address and phone number, a password (we only keep it in scrambled form, so we cannot read it) and, if you add one, a profile picture.',
        'Your orders: what you ordered, the date and time you asked for, any notes you wrote, the names you gave to share treats with, and whether you collect or want delivery.',
        'For delivery: your delivery address and the location your device shares when you tap “Check my delivery location”.',
        'Technical information: our hosting providers may keep standard logs (such as your IP address) to keep the service secure and working.',
      ],
    },
    {
      heading: 'Why we use it',
      bullets: [
        'To create and run your account.',
        'To take, prepare, deliver and collect your orders, and to contact you about them by phone or email.',
        'To keep the service secure and to prevent fraud and abuse.',
        'To keep the records we must keep by law, such as for accounting.',
      ],
      paragraphs: ['We do not sell your information, and we do not send marketing messages.'],
    },
    {
      heading: 'Your location',
      paragraphs: [
        'We only ask for your location when you tap “Check my delivery location”. We use it once, to check that you are inside our delivery area, and we send it with a delivery order so the order can be checked. We do not track you.',
      ],
    },
    {
      heading: 'Who can see it',
      bullets: [
        'Our staff, who can see your orders and contact details so they can serve you.',
        'A delivery person, who sees your name, phone number and address only after they accept your delivery.',
        'The companies that run the service for us: the website host, the server host, the database provider and the image host (which only stores product pictures, never customer information). Some of them may process information outside South Africa. We choose providers that protect it, and they may only use it to provide their service to us.',
        'Anyone else only if the law requires it.',
      ],
    },
    {
      heading: 'How long we keep it',
      paragraphs: [
        'We keep your information while your account is active and for as long as we need it for the purposes above and to meet accounting and other legal record-keeping requirements. After that we delete it or remove anything that identifies you.',
      ],
    },
    {
      heading: 'How we protect it',
      paragraphs: [
        'Connections to the site and the server are encrypted, passwords are stored in scrambled form, and what each person can see depends on their role. No system is perfectly safe. If we learn that your information has been accessed without permission we will tell you and the Information Regulator as the law requires.',
      ],
    },
    {
      heading: 'Your rights',
      paragraphs: [
        `Under POPIA you may ask us what information we hold about you, ask us to correct it or to delete it, object to how we use it, and withdraw your consent. You can correct your name and phone number yourself under Account. For anything else, ${contact(shop)}. If you are not happy with how we handle your information you may complain to the Information Regulator (South Africa) at https://inforegulator.org.za.`,
      ],
    },
    {
      heading: 'Cookies and browser storage',
      paragraphs: [
        'We do not use advertising or tracking cookies. Your browser keeps a sign-in token while you are signed in (it is removed when you close the tab or sign out), your basket, and a note that you have seen the welcome screen.',
      ],
    },
    {
      heading: 'Children',
      paragraphs: [
        'Our service is for adults. If you are under 18, please ask a parent or guardian to order for you.',
      ],
    },
    {
      heading: 'Changes to this notice',
      paragraphs: [
        'If we change this notice we will update this page and the date at the top. The version you agreed to when you registered is recorded with your account.',
      ],
    },
  ];
}

export function termsSections(shop: ShopInfo): LegalSection[] {
  return [
    {
      heading: 'About these terms',
      paragraphs: [
        `These terms apply when you use this website and order from ${shop.storeName}, ${shop.address}. By registering or placing an order you agree to them and to our Privacy Notice. If you do not agree, please do not use the service.`,
      ],
    },
    {
      heading: 'Pre-orders and confirmation',
      paragraphs: [
        'Every order is a pre-order. When you place one you are asking for your treats on the date and time you chose. We confirm the order, and the date and time, ourselves: the order is only accepted once we mark it as confirmed. We may decline or cancel an order, for example if an item is not available, and we will contact you if we do.',
      ],
    },
    {
      heading: 'Prices and payment',
      paragraphs: [
        'Prices are in South African rand. The total of an order is worked out by our system when you place it, from the prices at that moment. At the moment payment is in cash when you collect your order or when it is delivered. No online payment is taken.',
      ],
    },
    {
      heading: 'Collection and delivery',
      paragraphs: [
        'You can collect from our address. Delivery is only offered for mini donuts, to addresses within 5 km (in a straight line) of the shop. Please give an accurate address and a phone number that you will answer, because the delivery person may call you. If nobody can be reached we may not be able to complete the delivery.',
      ],
    },
    {
      heading: 'Changing or cancelling an order',
      paragraphs: [
        `Only the shop can change or cancel an order. If you need a change, ${contact(shop)} as early as you can. Because nothing is paid in advance, there is nothing to refund if an order is cancelled.`,
      ],
    },
    {
      heading: 'Allergens',
      paragraphs: [
        'Our treats may contain or have been in contact with common allergens such as nuts, milk, eggs, gluten and soy. We cannot promise that any item is free of them. Please tell us about any allergy before you order.',
      ],
    },
    {
      heading: 'Your account',
      paragraphs: [
        'Give us correct details and keep your password to yourself. You are responsible for what is done with your account, so tell us straight away if you think someone else is using it. We may suspend an account that is misused.',
      ],
    },
    {
      heading: 'Using the service properly',
      paragraphs: [
        'Please do not place false orders, try to break into the service or other people’s accounts, or interfere with how it works.',
      ],
    },
    {
      heading: 'Our responsibility',
      paragraphs: [
        'We take care in making and delivering your order. To the extent the law allows, we are not responsible for indirect or consequential loss, or for delays caused by things outside our control. Nothing in these terms takes away any right you have under the Consumer Protection Act, 2008 or other laws that cannot be limited.',
      ],
    },
    {
      heading: 'Changes to these terms',
      paragraphs: [
        'We may change these terms. The current version is always on this page with its date, and it applies to orders placed after the change.',
      ],
    },
    {
      heading: 'Law',
      paragraphs: ['These terms are governed by the laws of South Africa.'],
    },
  ];
}
