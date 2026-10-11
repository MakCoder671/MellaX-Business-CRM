# ----------------------------------------------------------------------------
# The written guide for each integration. Owners set these up on their own, with
# no support team to call, so every guide says the same things in the same order:
#
#   right_now       what works today, in one plain sentence
#   before_you_start what to have ready before opening the other app
#   setup           numbered steps. Each step has a title and short detail lines
#   help            extra "how do I find..." sections
#   can_do          what it does today
#   cannot_do       what it will never do, or can't do with the plan or setup
#   coming_next     what's planned but not switched on yet
#   problems        "if you see this message, do this" fixes
#
# Keep the wording plain. Don't use dashes in these lines. Use "to" and commas.
# ----------------------------------------------------------------------------

GUIDES = {
    "apple_calendar": {
        "right_now": "Works now. Connecting saves your Apple details, then sends your upcoming appointments to the calendar you choose.",
        "before_you_start": [
            "An Apple ID. This is the email address you use to sign in to iCloud or your iPhone.",
            "Two factor authentication turned on for that Apple ID. Apple requires it before you can make an app specific password. If you're not sure, open Settings on your iPhone, tap your name at the top, and look for Sign In and Security.",
            "A calendar in iCloud that you can add events to. Holidays, Birthdays, and subscribed calendars are read only, so MellaX can't add to them.",
            "About 10 minutes, and a safe place to save one password, like a password manager or a notes app.",
        ],
        "setup": [
            {
                "title": "Open Apple's account page",
                "details": [
                    "On a computer or phone, go to account.apple.com.",
                    "Sign in with your Apple ID.",
                ],
            },
            {
                "title": "Open Sign In and Security",
                "details": [
                    "Choose Sign In and Security from the menu. On a phone, it's in the list on the page.",
                ],
            },
            {
                "title": "Make an app specific password",
                "details": [
                    "Choose App-Specific Passwords.",
                    "Tap the plus (+) button, or choose Generate an app-specific password.",
                    "For the name, type MellaX. Then choose Create.",
                ],
            },
            {
                "title": "SAVE the password right now",
                "details": [
                    "Apple shows a password in four groups of letters, like abcd-efgh-ijkl-mnop.",
                    "Copy it and save it in a password manager or a note before you leave that page.",
                    "Apple will NOT show it to you again. If you lose it, come back to this page, delete that password, and make a new one. Then connect again in MellaX.",
                ],
            },
            {
                "title": "Go back to MellaX and connect",
                "details": [
                    "Open Integrations, then choose Apple Calendar.",
                    "In the first box, type the Apple ID email you use for iCloud.",
                    "In the second box, paste the app specific password exactly as Apple showed it. Keep the dashes.",
                    "Press Connect.",
                ],
            },
            {
                "title": "Choose your calendar",
                "details": [
                    "MellaX shows the calendars in your iCloud account. You don't type a calendar name. You choose one from the list.",
                    "Choose the calendar you look at every day, so your appointments show up where you already check.",
                    "Press Connect this calendar.",
                ],
            },
            {
                "title": "Check that it worked",
                "details": [
                    "The page says Connected.",
                    "Upcoming appointments show up in that calendar within a few minutes. Open the Calendar app on your phone, or go to icloud.com and open Calendar, to see them.",
                ],
            },
        ],
        "help": [
            {
                "title": "How to find the name of your calendar",
                "items": [
                    "You don't need to type the calendar name. MellaX lists the names, and you choose the one you want.",
                    "To see the names before you connect, open the Calendar app on your iPhone and tap Calendars at the bottom. The names listed there are the same names MellaX shows.",
                    "On a Mac, open the Calendar app. Your iCloud calendars are listed under the iCloud heading on the left.",
                    "On a computer, go to icloud.com, sign in, and open Calendar. The names on the left are the names MellaX shows.",
                    "Choose a calendar listed under iCloud. Calendars under Holidays, Birthdays, or Subscribed can't be written to.",
                    "If two calendars have the same name, choose the one where you already see your own appointments.",
                ],
            },
            {
                "title": "If you don't have a calendar to use yet",
                "items": [
                    "Go to icloud.com and open Calendar.",
                    "Choose the plus (+) button, or Add Calendar, and create a new calendar. Give it a name you'll recognize, like Work or Appointments.",
                    "Come back to MellaX, disconnect Apple Calendar, and connect again. The new calendar will be in the list.",
                ],
            },
        ],
        "can_do": [
            "Show every upcoming appointment you book in MellaX on your Apple Calendar, on all your Apple devices.",
            "Show appointments that clients book through your Landing Page the same way.",
            "Update the event when you move an appointment or change its notes.",
            "Remove the event when you cancel an appointment or delete it in MellaX.",
            "Keep completed and no-show appointments on the calendar as a record.",
            "When you first connect, send your appointments from yesterday through the next 180 days.",
        ],
        "cannot_do": [
            "Send anything you add in Apple Calendar back to MellaX. This only works one way. An event you add in Apple does NOT block that time in MellaX, so keep your personal plans in MellaX as well.",
            "Add events to Holidays, Birthdays, or any subscribed calendar. Those are read only.",
            "Sync Apple Reminders or to-do lists.",
            "Show your Apple Calendar inside MellaX.",
            "Send appointments that are more than 180 days away when you first connect. Those are sent once they are saved or changed.",
            "Keep working if you change your Apple password or delete the app specific password. You'll need to make a new one and connect again.",
            "Hide client names. Each event shows the service and the client's name, so anyone who can see that calendar can see them too.",
        ],
        "coming_next": [],
        "problems": [
            {
                "problem": "Apple didn't accept that Apple ID or password.",
                "fix": "Check the Apple ID email is spelled exactly right. Check that you pasted the app specific password, not your normal Apple password, and keep the dashes. If you're not sure, make a new password (step 3) and try again.",
            },
            {
                "problem": "We couldn't reach Apple right now.",
                "fix": "Apple's servers may be busy, or your internet dropped for a moment. Wait a few minutes, then press Connect again.",
            },
            {
                "problem": "My calendar isn't in the list.",
                "fix": "It's probably a Holidays, Birthdays, or subscribed calendar, and MellaX can't add events to those. Create a calendar under iCloud (see the help section above), then disconnect and connect again.",
            },
            {
                "problem": "The status says Needs attention.",
                "fix": "Read the note on the page. Most often Apple has stopped accepting the password. Make a new app specific password, then connect again.",
            },
            {
                "problem": "An appointment didn't show up in my calendar.",
                "fix": "Check that the page says Connected. Changes are sent when an appointment is saved, so open the appointment and save it again. If it still doesn't show, check you picked the right calendar. You can disconnect and connect again to choose another one.",
            },
        ],
    },
    "google_calendar": {
        "right_now": "Not available yet. This page shows exactly how it will work, so you know what's coming.",
        "before_you_start": [
            "A Google account that has a Google Calendar.",
            "Access to that Google account, so you can sign in and approve MellaX.",
        ],
        "setup": [
            {
                "title": "Press Connect",
                "details": ["Google opens so you can sign in."],
            },
            {
                "title": "Sign in to Google",
                "details": ["Sign in with the Google account that has the calendar you use for work."],
            },
            {
                "title": "Allow MellaX",
                "details": [
                    "Google lists what MellaX is asking to do: see and change your calendar events.",
                    "Read it, then press Allow.",
                ],
            },
            {
                "title": "Choose your calendar",
                "details": ["MellaX lists your calendars. Choose the one you want appointments in."],
            },
        ],
        "help": [
            {
                "title": "How to find the name of your calendar",
                "items": [
                    "You don't type the calendar name. You choose it from the list MellaX shows.",
                    "On a computer, open Google Calendar. Your calendars are listed on the left under My calendars.",
                    "Choose a calendar under My calendars. Calendars you only have view access to can't be written to.",
                ],
            },
        ],
        "can_do": [],
        "cannot_do": [
            "Work yet. This is not switched on.",
            "Send anything you add in Google Calendar back to MellaX. This will only work one way.",
            "Write to a calendar that you only have view access to.",
            "Keep working if you remove MellaX from your Google account. You'd need to connect again.",
        ],
        "coming_next": [
            "Send every upcoming appointment from MellaX to your Google Calendar.",
            "Update the event when an appointment changes, and remove it when it's cancelled or deleted.",
        ],
        "problems": [
            {
                "problem": "Google Calendar isn't switched on yet.",
                "fix": "It's being finished. Connect will appear here when it's ready.",
            },
        ],
    },
    "stripe": {
        "right_now": "Connecting works now. MellaX checks your two keys with Stripe, then saves them. Charging cards and EMV payments from invoices are being built next, so they don't work yet.",
        "before_you_start": [
            "Card processing is a Plus feature. On Basic you can still record payments by hand, but to connect this you need to upgrade to Plus first.",
            "A Stripe account. You can sign up for free at stripe.com.",
            "Start in Test mode. Test mode uses fake cards and moves no real money, so try everything there first.",
            "For real payments later, finish Stripe's business checks. Stripe asks for your business details and a bank account before live payments work.",
            "Two keys to copy: a restricted key and a publishable key. Keep your Stripe page open in one tab while you work.",
        ],
        "setup": [
            {
                "title": "Open your Stripe Dashboard",
                "details": [
                    "Go to dashboard.stripe.com and sign in.",
                    "Look at the top right. If it says Test mode, you're in test mode, which is what you want to start with.",
                ],
            },
            {
                "title": "Open API keys",
                "details": [
                    "Choose Developers in the top menu.",
                    "Choose API keys.",
                ],
            },
            {
                "title": "Copy your publishable key",
                "details": [
                    "Find the box called Publishable key. Test keys start with pk_test_.",
                    "Copy the whole key. It isn't secret, so it's fine to have it on screen.",
                ],
            },
            {
                "title": "Create a restricted key",
                "details": [
                    "Choose Create restricted key, and name it MellaX.",
                    "Give Write access to Payment Intents, Refunds, and Terminal. Give Read access to Charges.",
                    "Choose Create key.",
                ],
            },
            {
                "title": "SAVE the restricted key right now",
                "details": [
                    "Stripe shows the restricted key only once. Copy it and save it in a password manager or a note before you leave that page.",
                    "Test restricted keys start with rk_test_. Live ones start with rk_live_.",
                ],
            },
            {
                "title": "Paste both keys into MellaX",
                "details": [
                    "Open Integrations, then choose Stripe.",
                    "In the first box, paste the restricted key (it starts with rk_).",
                    "In the second box, paste the publishable key (it starts with pk_).",
                    "Press Connect. MellaX checks both keys with Stripe before it saves them.",
                ],
            },
            {
                "title": "Check that it says Connected",
                "details": [
                    "If the page says Connected, the connection is saved.",
                    "If it doesn't, read the message on the page and find it in the trouble section below.",
                ],
            },
        ],
        "help": [
            {
                "title": "What test mode and live mode mean",
                "items": [
                    "Test mode: fake cards and no real money. Keys have test in their names, like pk_test_ and rk_test_.",
                    "Live mode: real cards and real money. Keys have live in their names, like pk_live_ and rk_live_.",
                    "Both keys must be from the same mode. Switching to live means creating new keys in live mode and connecting again.",
                ],
            },
        ],
        "can_do": [
            "Connect your own Stripe account to MellaX, in test mode or in live mode.",
            "Check both keys with Stripe before saving, so a wrong key is caught right away.",
            "Store your keys encrypted. Once saved, they are never shown again on screen.",
        ],
        "cannot_do": [
            "Charge a card yet. Card charging is being built next.",
            "Take an EMV (chip or tap) payment yet. That is being built next.",
            "Refund a payment yet. Refunds are being built next.",
            "Hold your money. Stripe pays money into your own bank account on Stripe's schedule.",
            "Lower Stripe's fees. Stripe still charges its normal card processing fees.",
            "Take real payments until your Stripe account is set up for live mode.",
        ],
        "coming_next": [
            "Charge a card typed in on an invoice. You enter the amount, press Process, and get an approved message.",
            "Send an amount to a Stripe card reader (EMV), so the customer can tap or insert a card.",
            "Refund a card payment through Stripe, so the money goes back to the customer's card.",
            "Stop a charge that hasn't gone through yet when its invoice is deleted. If the invoice was already charged, deleting it is blocked until you refund that charge first.",
        ],
        "problems": [
            {
                "problem": "Stripe didn't accept that key.",
                "fix": "Copy the whole key again. Test keys start with rk_test_ and live keys start with rk_live_. Make sure the key came from the same Stripe account you're signed in to.",
            },
            {
                "problem": "That key can't read payments.",
                "fix": "In Stripe, open the restricted key, give it Write access to Payment Intents, Refunds, and Terminal, and save. Then copy the key again and connect.",
            },
            {
                "problem": "Use keys from the same mode.",
                "fix": "Both keys must be test keys (with test in the name) or both must be live keys. Copy both from the same mode in Stripe.",
            },
            {
                "problem": "Those don't look like Stripe keys.",
                "fix": "Restricted keys start with rk_. Publishable keys start with pk_. Check that each key is in the right box.",
            },
            {
                "problem": "We couldn't reach Stripe right now.",
                "fix": "Check your internet connection, wait a few minutes, and press Connect again.",
            },
        ],
    },
    "square": {
        "right_now": "Not switched on yet. Square isn't connected to MellaX until its setup is finished, so Connect won't work yet. This page shows exactly how it will work.",
        "before_you_start": [
            "Card processing is a Plus feature. On Basic you can still record payments by hand, but to connect this you need to upgrade to Plus first.",
            "A Square account for your business.",
            "The person who owns the Square account, since they must sign in and approve MellaX.",
            "A Square location, which is the place your payments come from. If you take payments in person, have your Square reader or Point of Sale ready.",
        ],
        "setup": [
            {
                "title": "Press Connect",
                "details": ["Square opens its own sign in page. Your Square login stays with Square. MellaX never sees your password."],
            },
            {
                "title": "Sign in to Square",
                "details": ["Sign in with the Square login for the business."],
            },
            {
                "title": "Choose your location",
                "details": [
                    "Pick the Square location your payments come from.",
                    "If you have more than one, choose the one you use most.",
                ],
            },
            {
                "title": "Allow MellaX",
                "details": [
                    "Square lists what MellaX is asking to do. Read it, then choose Allow.",
                    "Square sends you back to MellaX.",
                ],
            },
            {
                "title": "Check that it says Connected",
                "details": ["If it doesn't, read the message on the page and find it in the trouble section below."],
            },
        ],
        "help": [
            {
                "title": "Where to find your location",
                "items": [
                    "Sign in to your Square Dashboard and look for Locations in the menu.",
                    "The names listed there are the locations you can choose.",
                ],
            },
        ],
        "can_do": [],
        "cannot_do": [
            "Work yet. Square isn't switched on in MellaX.",
            "Take Square payments on an invoice yet. That is planned, and will work like Stripe does.",
            "Send money to your bank. Square pays money into your Square bank account on Square's schedule.",
            "Lower Square's fees. Square still charges its normal processing fees.",
        ],
        "coming_next": [
            "Charge a card typed in on an invoice. You enter the amount, press Process, and get an approved message.",
            "Send an amount to a Square reader (EMV), so the customer can tap or insert a card.",
            "Refund a card payment through Square, so the money goes back to the customer's card.",
            "Stop a charge that hasn't gone through yet when its invoice is deleted. If the invoice was already charged, deleting it is blocked until you refund that charge first.",
            "Show card type and last 4 digits on invoices for payments taken through Square.",
        ],
        "problems": [
            {
                "problem": "Square isn't switched on yet.",
                "fix": "Square's connection is being finished. Connect will work here once it's ready.",
            },
        ],
    },
    "clover": {
        "right_now": "Not switched on yet. Clover isn't connected to MellaX until its setup is finished, so Connect won't work yet. This page shows exactly how it will work.",
        "before_you_start": [
            "Card processing is a Plus feature. On Basic you can still record payments by hand, but to connect this you need to upgrade to Plus first.",
            "A Clover account for your business, with a Clover device (like a Flex, Mini, or Station) signed in to that account.",
            "The owner or a manager who can sign in to Clover and approve MellaX.",
            "Your Clover device switched on and connected to the internet, if you want to take payments on it.",
        ],
        "setup": [
            {
                "title": "Press Connect",
                "details": ["Clover opens its own sign in page. Your Clover login stays with Clover. MellaX never sees your password."],
            },
            {
                "title": "Sign in to Clover",
                "details": ["Sign in with the Clover login for the business."],
            },
            {
                "title": "Choose your merchant account",
                "details": [
                    "Pick the Clover merchant account your device belongs to.",
                    "Your device must be on that same account, or its payments won't come through.",
                ],
            },
            {
                "title": "Allow MellaX",
                "details": [
                    "Clover lists what MellaX is asking to do. Read it, then choose Allow.",
                    "Clover sends you back to MellaX.",
                ],
            },
            {
                "title": "Check that it says Connected",
                "details": ["If it doesn't, read the message on the page and find it in the trouble section below."],
            },
        ],
        "help": [],
        "can_do": [],
        "cannot_do": [
            "Work yet. Clover isn't switched on in MellaX.",
            "Take Clover payments on an invoice yet. That is planned, and will work like Stripe does.",
            "Send money to your bank. Clover pays money into your bank account on Clover's schedule.",
            "Lower Clover's fees. Clover still charges its normal processing fees.",
        ],
        "coming_next": [
            "Show how each invoice was paid when the payment went through a Clover device: card type, last 4 digits, and chip or card on file.",
            "Send an amount to your Clover device, so the customer can pay on it.",
            "Refund a Clover card payment, so the money goes back to the customer's card.",
            "Stop a payment that hasn't gone through yet when its invoice is deleted. If the invoice was already paid, deleting it is blocked until you refund that payment first.",
        ],
        "problems": [
            {
                "problem": "Clover isn't switched on yet.",
                "fix": "Clover's connection is being finished. Connect will work here once it's ready.",
            },
        ],
    },
    "zapier": {
        "right_now": "Works now. Connecting sends a test message to your Zapier link. After that, MellaX sends new bookings, paid invoices, and new clients to Zapier as they happen.",
        "before_you_start": [
            "A Zapier account. You can sign up for free at zapier.com.",
            "The app you want MellaX to send to through Zapier, like a spreadsheet, an email tool, or a calendar.",
            "About 10 minutes, and permission to make Zaps in that Zapier account.",
        ],
        "setup": [
            {
                "title": "Start a new Zap in Zapier",
                "details": [
                    "Sign in to zapier.com, then choose Create, then Zaps.",
                    "For the app that starts the Zap, search for Webhooks by Zapier and choose it.",
                    "Pick the Catch Hook event, then choose Continue.",
                ],
            },
            {
                "title": "Copy your webhook link",
                "details": [
                    "Zapier shows a custom webhook link. It starts with https://hooks.zapier.com/.",
                    "Copy the whole link before you leave that page.",
                ],
            },
            {
                "title": "Connect it in MellaX",
                "details": [
                    "Open Integrations, then choose Zapier.",
                    "Paste the link in the box and press Connect. MellaX sends a test message to check it.",
                ],
            },
            {
                "title": "Finish the Zap in Zapier",
                "details": [
                    "Back in Zapier, press Test trigger. You should see the test message MellaX sent.",
                    "Add the app you want MellaX to send to, match the fields, and turn the Zap on.",
                ],
            },
        ],
        "help": [],
        "can_do": [
            "Send each new booking, with the client, service, and time.",
            "Send each paid invoice, with the invoice number, client, and amount.",
            "Send each new client, with their name, email, and phone number.",
        ],
        "cannot_do": [
            "Receive anything from Zapier. This only sends from MellaX to Zapier.",
            "Send anything you didn't create in MellaX. Only the three events above are sent.",
            "Send bookings, invoices, or clients from before you connected. Only new ones are sent.",
            "Work until you finish the Zap in Zapier and turn it on.",
        ],
        "coming_next": [],
        "problems": [
            {
                "problem": "That doesn't look like a Zapier link.",
                "fix": "Copy the link from Zapier's Catch Hook step. It starts with https://hooks.zapier.com/.",
            },
            {
                "problem": "We couldn't reach Zapier right now.",
                "fix": "Check your internet connection, wait a few minutes, and press Connect again.",
            },
            {
                "problem": "The status says Needs attention.",
                "fix": "In Zapier, check that the Zap is still turned on. Anything sent while it was off was not received, so the Zap needs to be on again.",
            },
        ],
    },
    "slack": {
        "right_now": "Works now. Connecting posts a test message to the Slack channel you choose. After that, new bookings and paid invoices are posted there.",
        "before_you_start": [
            "A Slack workspace where you're allowed to add apps.",
            "The Slack channel where you want the messages, like #bookings. You must be able to post in that channel.",
        ],
        "setup": [
            {
                "title": "Add Incoming Webhooks in Slack",
                "details": [
                    "In Slack, open the Apps section and search for Incoming Webhooks.",
                    "Choose Add to Slack, then pick the channel for the messages, and allow it.",
                ],
            },
            {
                "title": "Copy your webhook link",
                "details": [
                    "Slack shows a Webhook URL. It starts with https://hooks.slack.com/.",
                    "Copy it now. Slack shows it on that page, so keep it somewhere safe.",
                ],
            },
            {
                "title": "Connect it in MellaX",
                "details": [
                    "Open Integrations, then choose Slack.",
                    "Paste the link in the box and press Connect.",
                ],
            },
            {
                "title": "Check the channel",
                "details": ["Open the channel in Slack. You should see a test message from MellaX."],
            },
        ],
        "help": [],
        "can_do": [
            "Post each new booking, with the client, service, and time.",
            "Post each paid invoice, with the invoice number, client, and amount.",
        ],
        "cannot_do": [
            "Read or reply to Slack messages.",
            "Post into a channel other than the one you picked.",
            "Send direct messages to a person.",
            "Post phone numbers or email addresses. Only the short booking and payment summaries are posted.",
        ],
        "coming_next": [],
        "problems": [
            {
                "problem": "That doesn't look like a Slack link.",
                "fix": "Copy the Webhook URL from Slack. It starts with https://hooks.slack.com/.",
            },
            {
                "problem": "The status says Needs attention.",
                "fix": "The webhook may have been removed in Slack. Add Incoming Webhooks again, copy the new link, and connect it in MellaX.",
            },
        ],
    },
    "mailchimp": {
        "right_now": "Works now. Connecting checks your key and audience with Mailchimp. After that, each new client with an email address is added to your audience, pending their confirmation.",
        "before_you_start": [
            "A Mailchimp account with an audience, which is the list of people you email.",
            "Permission to create API keys in that Mailchimp account.",
            "Your clients need to agree to hear from you. Mailchimp's rules require it, so MellaX adds new clients as pending until they confirm.",
        ],
        "setup": [
            {
                "title": "Create an API key in Mailchimp",
                "details": [
                    "Open your profile menu in Mailchimp, then choose Extras, then API keys.",
                    "Choose Create A Key and name it MellaX.",
                    "Copy the whole key. It ends in a code like -us21. Mailchimp may not show it again, so save it now.",
                ],
            },
            {
                "title": "Find your Audience ID",
                "details": [
                    "Open Audience in Mailchimp, then Settings, then Audience name and defaults.",
                    "Copy the Audience ID shown on that page.",
                ],
            },
            {
                "title": "Connect it in MellaX",
                "details": [
                    "Open Integrations, then choose Mailchimp.",
                    "Paste the API key and the Audience ID, then press Connect. MellaX checks both with Mailchimp.",
                ],
            },
            {
                "title": "Confirm the new clients",
                "details": [
                    "When a new client with an email is saved, Mailchimp sends them a confirmation email.",
                    "They're on your audience once they confirm.",
                ],
            },
        ],
        "help": [],
        "can_do": [
            "Add each new client who has an email address to your audience, as pending until they confirm.",
            "Keep the client's first and last name on their audience record.",
        ],
        "cannot_do": [
            "Send emails. MellaX only adds people to your audience.",
            "Add clients who don't have an email address.",
            "Skip Mailchimp's confirmation step. Clients must confirm before they're on your list.",
            "Remove anyone from your audience. Unsubscribes are handled in Mailchimp.",
        ],
        "coming_next": [],
        "problems": [
            {
                "problem": "Mailchimp didn't accept that API key.",
                "fix": "Copy the whole key again. It ends in a code like -us21. If you deleted the key in Mailchimp, create a new one.",
            },
            {
                "problem": "Mailchimp couldn't find that audience.",
                "fix": "Check the Audience ID in Mailchimp under Audience, then Settings, then Audience name and defaults.",
            },
            {
                "problem": "We couldn't reach Mailchimp right now.",
                "fix": "Check your internet connection, wait a few minutes, and press Connect again.",
            },
        ],
    },
}
