// ----------------------------------------------------------------------------
// The "handful of built-in templates" from the plan doc's Marketing
// (Basic version) feature. These are just starting text — picking one
// fills in the subject/body fields on the compose form, which then stay
// fully editable. No backend model needed for these (see the comment at
// the top of marketing/models.py for why); they're plain data, so adding
// a fifth template later is just adding an entry to this array.
// ----------------------------------------------------------------------------

export type EBlastTemplate = {
  key: string;
  name: string;
  subject: string;
  body: string;
};

export const EBLAST_TEMPLATES: EBlastTemplate[] = [
  {
    key: "blank",
    name: "Blank",
    subject: "",
    body: "",
  },
  {
    key: "seasonal-promo",
    name: "Seasonal Promotion",
    subject: "A little something for you this season",
    body: "Hi there,\n\nWe wanted to let you know about a special offer running for a limited time. Reach out if you'd like to book!\n\nThanks for being a valued client.",
  },
  {
    key: "new-service",
    name: "New Service Announcement",
    subject: "We just added something new",
    body: "Hi there,\n\nWe're excited to share that we've added a new service. Reach out if you'd like to learn more or get on the schedule.\n\nTalk soon!",
  },
  {
    key: "newsletter",
    name: "Newsletter / Update",
    subject: "What's new with us",
    body: "Hi there,\n\nJust a quick update on what we've been up to lately. Thanks for sticking with us!",
  },
  {
    key: "we-miss-you",
    name: "We Miss You",
    subject: "It's been a while!",
    body: "Hi there,\n\nWe noticed it's been a while since your last visit. We'd love to see you again. Let us know if you'd like to book something soon.",
  },
];
