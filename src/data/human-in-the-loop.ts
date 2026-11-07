/**
 * The invented example behind the figures in notes/the-human-in-the-loop: a
 * dozen services, the teams that own them, the brief each team reads its own
 * way, the plan a model wrote from it, one correction to that plan, and the
 * deliverables it was broken into. Every figure draws from this one file so
 * that a service keeps its place and its colour from the first figure to the
 * last.
 *
 * None of it is a real system. The note says so.
 */

export interface Service {
  id: string;
  name: string;
  /** Centre of the box on the 640×400 map. */
  x: number;
  y: number;
  /** Hue of the service's tint, 0–360. */
  hue: number;
}

export interface Contract {
  id: string;
  from: string;
  to: string;
  /** What the call is, as the caller would put it. */
  label: string;
}

/** Twelve services, one team each, laid out roughly in the order an order moves through them. */
export const services: Service[] = [
  { id: 'catalogue', name: 'Catalogue', x: 72, y: 70, hue: 60 },
  { id: 'orderpage', name: 'Order page', x: 72, y: 200, hue: 210 },
  { id: 'accounts', name: 'Accounts', x: 72, y: 330, hue: 300 },
  { id: 'pricing', name: 'Pricing', x: 232, y: 70, hue: 30 },
  { id: 'checkout', name: 'Checkout', x: 232, y: 200, hue: 0 },
  { id: 'payments', name: 'Payments', x: 232, y: 330, hue: 270 },
  { id: 'inventory', name: 'Inventory', x: 392, y: 70, hue: 90 },
  { id: 'orders', name: 'Orders', x: 392, y: 200, hue: 150 },
  { id: 'reporting', name: 'Reporting', x: 392, y: 330, hue: 330 },
  { id: 'warehouse', name: 'Warehouse', x: 552, y: 70, hue: 120 },
  { id: 'shipping', name: 'Shipping', x: 552, y: 200, hue: 180 },
  { id: 'notifications', name: 'Notifications', x: 552, y: 330, hue: 240 },
];

export const contracts: Contract[] = [
  { id: 'op-cat', from: 'orderpage', to: 'catalogue', label: 'product details' },
  { id: 'op-acc', from: 'orderpage', to: 'accounts', label: 'who is signed in' },
  { id: 'op-ord', from: 'orderpage', to: 'orders', label: 'read an order' },
  { id: 'co-pri', from: 'checkout', to: 'pricing', label: 'price a basket' },
  { id: 'co-pay', from: 'checkout', to: 'payments', label: 'take payment' },
  { id: 'co-inv', from: 'checkout', to: 'inventory', label: 'reserve stock' },
  { id: 'co-ord', from: 'checkout', to: 'orders', label: 'create an order' },
  { id: 'co-shp', from: 'checkout', to: 'shipping', label: 'shipping options' },
  { id: 'ord-wh', from: 'orders', to: 'warehouse', label: 'pick and pack' },
  { id: 'ord-not', from: 'orders', to: 'notifications', label: 'order confirmed' },
  { id: 'ord-rep', from: 'orders', to: 'reporting', label: 'order events' },
  { id: 'wh-inv', from: 'warehouse', to: 'inventory', label: 'stock movements' },
  { id: 'wh-shp', from: 'warehouse', to: 'shipping', label: 'book a carrier' },
  { id: 'shp-not', from: 'shipping', to: 'notifications', label: 'dispatched' },
];

export const brief = 'Show customers an estimated delivery date on the order page.';

export interface Reading {
  team: string;
  /** Services this team expects to change. Empty means it expects none. */
  changes: string[];
  note: string;
}

/**
 * What each team took the brief to mean. They are all reasonable; that is the
 * point. Ordered so the three readings the text names come first.
 */
export const readings: Reading[] = [
  {
    team: 'checkout',
    changes: ['checkout', 'orders', 'orderpage'],
    note: 'Calculate the date when the order is placed and store it on the order.',
  },
  {
    team: 'warehouse',
    changes: ['warehouse', 'shipping', 'orders', 'orderpage'],
    note: 'Send a date once the order has been picked and the carrier is booked.',
  },
  {
    team: 'orderpage',
    changes: ['orderpage'],
    note: 'Add a date field to the page. One of the other services will provide it.',
  },
  {
    team: 'shipping',
    changes: ['shipping', 'orders', 'notifications'],
    note: 'The carrier gives an ETA at booking. Pass it on and put it in the dispatch email.',
  },
  {
    team: 'orders',
    changes: ['orders'],
    note: 'Store whichever date we are given. Who calculates it is not our call.',
  },
  {
    team: 'inventory',
    changes: ['inventory', 'checkout'],
    note: 'The date depends on which site has the stock, so checkout has to ask us.',
  },
  {
    team: 'accounts',
    changes: ['accounts', 'orderpage'],
    note: 'Show it in order history too, which means the account service returns it.',
  },
  {
    team: 'notifications',
    changes: ['notifications'],
    note: 'Put the date in the confirmation email. Nothing else changes for us.',
  },
  {
    team: 'reporting',
    changes: ['reporting'],
    note: 'Record the date promised against the date delivered.',
  },
  { team: 'catalogue', changes: [], note: 'No change expected.' },
  { team: 'pricing', changes: [], note: 'No change expected.' },
  { team: 'payments', changes: [], note: 'No change expected.' },
];

export interface PlanLine {
  /** The service this line changes. */
  s: string;
  text: string;
  /** This line settles something the brief left open. */
  decision?: boolean;
  /** Contracts this line changes or relies on. */
  touches?: string[];
}

/**
 * The plan, in the order the model wrote it. Changes to one service are mixed
 * in with everyone else's, because the model worked through the feature in
 * dependency order, not team by team.
 */
export const plan: PlanLine[] = [
  { s: 'shipping', text: 'Add an EstimateDelivery call that takes a postcode, a shipping option and a dispatch site, and returns a date range.', decision: true, touches: ['co-shp'] },
  { s: 'shipping', text: 'Back the estimate with the carrier transit tables already used for pricing shipping options.' },
  { s: 'shipping', text: 'Treat the site’s cutoff time as part of the estimate: an order placed after cutoff dispatches the next working day.', decision: true },
  { s: 'inventory', text: 'Return the site the order is expected to dispatch from alongside the reservation, so the caller can estimate from it.', decision: true, touches: ['co-inv'] },
  { s: 'checkout', text: 'After reserving stock, call EstimateDelivery with the postcode, the chosen option and the expected site.', decision: true, touches: ['co-inv', 'co-shp'] },
  { s: 'checkout', text: 'Show the estimate on the delivery options step, so the customer sees it before paying.', decision: true },
  { s: 'orders', text: 'Add promisedDeliveryDate (a range) and expectedDispatch to the order record, written by Checkout and read by the order page.', decision: true, touches: ['co-ord', 'op-ord'] },
  { s: 'checkout', text: 'Write the estimate to the order as promisedDeliveryDate when the order is created.', decision: true, touches: ['co-ord'] },
  { s: 'orders', text: 'Include promisedDeliveryDate in the order-confirmed event.', touches: ['ord-not', 'ord-rep'] },
  { s: 'orderpage', text: 'Read promisedDeliveryDate from the order and show it under the order status.', decision: true, touches: ['op-ord'] },
  { s: 'orderpage', text: 'Show the range as “Arriving Tuesday 3 to Thursday 5 March”; collapse to one day when the range is a day.' },
  { s: 'notifications', text: 'Add the promised date to the order-confirmation email template.', touches: ['ord-not'] },
  { s: 'warehouse', text: 'When an order is picked, send expectedDispatch to Orders.', decision: true, touches: ['ord-wh'] },
  { s: 'orders', text: 'Accept expectedDispatch updates from Warehouse and store them against the order.', touches: ['ord-wh'] },
  { s: 'shipping', text: 'When a carrier is booked, send the carrier’s ETA to Orders as a revised promisedDeliveryDate.', decision: true, touches: ['wh-shp'] },
  { s: 'orders', text: 'Accept a revised promisedDeliveryDate from Shipping and raise a delivery-date-changed event when it moves outside the original range.', decision: true, touches: ['ord-not'] },
  { s: 'notifications', text: 'Send a delivery-date-changed email on that event.', touches: ['ord-not'] },
  { s: 'notifications', text: 'Add the current promised date to the dispatch email.', touches: ['shp-not'] },
  { s: 'orderpage', text: 'Show “Updated” beside the date when it has been revised, with the original range on hover.' },
  { s: 'reporting', text: 'Record promisedDeliveryDate and the actual delivery date for every order.', touches: ['ord-rep'] },
  { s: 'reporting', text: 'Add a report of promised against actual by site and carrier.' },
  { s: 'accounts', text: 'Return promisedDeliveryDate in the order-history list.', touches: ['op-acc'] },
  { s: 'orderpage', text: 'Show the date in order history as well as on the order page.' },
  { s: 'inventory', text: 'Expose each site’s cutoff time to Shipping, which needs it for the estimate.', touches: ['wh-inv'] },
  { s: 'shipping', text: 'Read site cutoff times from Inventory rather than keeping a copy.' },
  { s: 'checkout', text: 'If EstimateDelivery fails, place the order without a date rather than blocking checkout.', decision: true },
  { s: 'orderpage', text: 'When there is no date, show nothing rather than a placeholder.' },
  { s: 'catalogue', text: 'No change.' },
  { s: 'pricing', text: 'No change.' },
  { s: 'payments', text: 'No change.' },
  { s: 'warehouse', text: 'Add a test fixture for a site with a 2 pm cutoff and a site with none.' },
  { s: 'shipping', text: 'Test estimates either side of cutoff, across a weekend, and for a postcode the carrier does not serve.' },
  { s: 'checkout', text: 'Test the order is created with and without an estimate.' },
  { s: 'orders', text: 'Test that a revised date inside the original range raises no event.' },
  { s: 'orderpage', text: 'Test the four states: no date, a range, a single day, a revised date.' },
  { s: 'notifications', text: 'Test all three templates render with and without a date.' },
  { s: 'shipping', text: 'Deploy first: EstimateDelivery ships behind a flag with nothing calling it.' },
  { s: 'orders', text: 'Deploy second: the new fields are optional, so nothing breaks before Checkout writes them.' },
  { s: 'inventory', text: 'Deploy third: the expected site and cutoff times are returned, and nothing reads them yet.' },
  { s: 'checkout', text: 'Deploy fourth, behind a flag per market.' },
  { s: 'warehouse', text: 'Deploy fifth: expectedDispatch starts flowing.' },
  { s: 'orderpage', text: 'Deploy sixth: the date appears for flagged markets.' },
  { s: 'notifications', text: 'Deploy seventh: templates read the date when present.' },
  { s: 'accounts', text: 'Deploy eighth: order history returns the date.' },
  { s: 'reporting', text: 'Deploy last: the report has data from the day Checkout went live.' },
];

/**
 * One correction the warehouse team made in review. The model had the
 * warehouse report a dispatch date when an order is picked; in this system an
 * order is allocated to a site within minutes, not always the site Inventory
 * expected, and picked days later, so the estimate from checkout would go
 * uncorrected for most of that time.
 */
export const pullRequest = {
  title: 'Send expectedDispatch at allocation, not at pick',
  author: 'warehouse',
  removed: [
    { s: 'warehouse', text: 'When an order is picked, send expectedDispatch to Orders.' },
  ],
  added: [
    { s: 'warehouse', text: 'When an order is allocated to a site, send expectedDispatch to Orders using that site’s cutoff. Send it again if the pick changes it.' },
  ],
  /** Deployment steps, before and after. */
  orderBefore: ['shipping', 'orders', 'inventory', 'checkout', 'warehouse', 'orderpage', 'notifications', 'accounts', 'reporting'],
  orderAfter: ['shipping', 'orders', 'inventory', 'warehouse', 'checkout', 'orderpage', 'notifications', 'accounts', 'reporting'],
  comment:
    'Allocation happens a few minutes after checkout, and it can move an order to a different site from the one Inventory expected. Picking can be days later. Until pick, the page would show the estimate from checkout with nothing from us to correct it, and allocation is where we first know for certain which site and which cutoff the order has. That also means we should be live before Checkout starts writing dates.',
};

export interface Deliverable {
  s: string;
  title: string;
  /** Tests that check this service alone. */
  isolated: number;
  /** Tests that run across the real services. */
  endToEnd: number;
}

/** The plan broken into issues, one per service, in the deployment order agreed after the correction above. */
export const deliverables: Deliverable[] = [
  { s: 'shipping', title: 'EstimateDelivery behind a flag, and a revised date at carrier booking', isolated: 9, endToEnd: 1 },
  { s: 'orders', title: 'promisedDeliveryDate and expectedDispatch fields', isolated: 4, endToEnd: 0 },
  { s: 'inventory', title: 'Expected site and cutoff times', isolated: 3, endToEnd: 0 },
  { s: 'warehouse', title: 'expectedDispatch at allocation', isolated: 4, endToEnd: 0 },
  { s: 'checkout', title: 'Estimate at checkout, written to the order', isolated: 5, endToEnd: 1 },
  { s: 'orderpage', title: 'Date on the order page and in history', isolated: 4, endToEnd: 1 },
  { s: 'notifications', title: 'Date in three email templates', isolated: 3, endToEnd: 0 },
  { s: 'accounts', title: 'Date in order history', isolated: 2, endToEnd: 0 },
  { s: 'reporting', title: 'Promised against actual', isolated: 2, endToEnd: 1 },
];

export interface CompanySystem {
  name: string;
  what: string;
  /** The step, counting from 1, at which the company starts using it. */
  from: number;
  /** Every team uses it or has a record in it: pay, contracts, logins. */
  everyone?: boolean;
  /** Departments, besides the one that looks after it, whose teams use it. */
  usedBy?: string[];
  /** Systems it passes information to, once both exist. */
  feeds?: string[];
}

export interface Team {
  name: string;
  what: string;
  /** Where the department sits in the figure, on a 1000 by 600 canvas: the cafés in the middle, the rest around them. */
  x: number;
  y: number;
  /** How many people it has at each step; 0 until it exists. */
  people: number[];
  systems: CompanySystem[];
}

export interface GrowthStep {
  title: string;
  text: string;
  /** How many cafés there are. Each café is one team. */
  cafes: number;
}

/**
 * The coffee company in the opening, from one person at a till to a dozen
 * cafés and an app. The numbers are a sketch, kept to the lean end of real
 * chains: about nine staff to a café, close to Joe & The Juice UK's 2024
 * accounts (738 staff, 657 of them in about 70 sites). 46 systems sits under
 * Okta's 2024 average of 58 apps for companies of 500 or fewer. The figure
 * draws each team, not each person: a café, or a small team of up to five.
 */
export const growth: GrowthStep[] = [
  {
    title: 'One person, one till',
    text: 'The owner makes the coffee, takes the money and decides everything. There is one system: the till.',
    cafes: 1,
  },
  {
    title: 'A second pair of hands',
    text: 'One more person behind the counter, and the owner is now an employer: wages to pay, tax to take off them, insurance, a contract and a rota.',
    cafes: 1,
  },
  {
    title: 'A second café',
    text: 'The owner can’t be in both. A manager runs the second café, someone keeps the books, and suppliers deliver to two places at one set of prices.',
    cafes: 2,
  },
  {
    title: 'Five cafés',
    text: 'Someone buys for all five, someone hires and trains, someone runs the website. Each of those jobs gets software of its own.',
    cafes: 5,
  },
  {
    title: 'Twelve cafés',
    text: 'A head office: finance, people, buying, marketing, IT, and a warehouse supplying the cafés. The systems start passing information to each other.',
    cafes: 12,
  },
  {
    title: 'An app',
    text: 'An app to order ahead, and deliveries. A team to build it, people to answer the customers who use it, and every system the cafés use now has to talk to it.',
    cafes: 12,
  },
];

export const teams: Team[] = [
  {
    name: 'Cafés',
    what: 'The people making and selling the coffee, and the manager of each café.',
    x: 500, y: 300,
    people: [1, 2, 16, 45, 112, 112],
    systems: [
      { name: 'Till', what: 'Every sale, in every café.', from: 1, feeds: ['Card payments', 'Bookkeeping', 'Stock', 'Dashboards', 'Loyalty'] },
      { name: 'Card payments', what: 'The card reader, and the company behind it.', from: 2, feeds: ['Bookkeeping'] },
      { name: 'Rota', what: 'Who works which shift, where.', from: 2, feeds: ['Payroll'] },
      { name: 'Food safety log', what: 'Fridge temperatures and cleaning, checked and signed.', from: 3 },
      { name: 'Café wifi', what: 'The network the tills and customers share.', from: 4 },
      { name: 'Café checklists', what: 'Opening, closing and audits, café by café.', from: 4 },
      { name: 'Repairs', what: 'Broken grinders and leaking taps, and who is fixing them.', from: 5, feeds: ['Invoicing'] },
      { name: 'Kitchen screens', what: 'Orders from the till and the app, shown to whoever is making them.', from: 6 },
    ],
  },
  {
    name: 'Buying',
    what: 'Beans, milk, cups, and the suppliers behind them.',
    x: 640, y: 200,
    people: [0, 0, 0, 1, 2, 2],
    systems: [
      { name: 'Supplier orders', what: 'What has been ordered, from whom, at what price.', from: 3, feeds: ['Stock', 'Invoicing'] },
      { name: 'Price list', what: 'What every item sells for, in every café.', from: 3, usedBy: ['Cafés', 'Marketing'], feeds: ['Till', 'Menu boards', 'Website', 'App'] },
      { name: 'Stock', what: 'What is where, and what is on its way.', from: 4, usedBy: ['Cafés', 'Warehouse'] },
      { name: 'Recipes', what: 'What goes into every drink, and so what each one costs.', from: 4, usedBy: ['Cafés'], feeds: ['Stock', 'Price list'] },
    ],
  },
  {
    name: 'Warehouse',
    what: 'Supplying the cafés, then delivering to customers.',
    x: 790, y: 130,
    people: [0, 0, 0, 0, 2, 3],
    systems: [
      { name: 'Warehouse system', what: 'Every shelf, every pick.', from: 5, feeds: ['Stock'] },
      { name: 'Deliveries', what: 'Couriers and vans, and where each parcel is.', from: 6, usedBy: ['Customer service'], feeds: ['Online orders'] },
    ],
  },
  {
    name: 'Finance',
    what: 'The books, the bills and the tax.',
    x: 670, y: 410,
    people: [0, 0, 1, 1, 2, 3],
    systems: [
      { name: 'Bookkeeping', what: 'Every sale and every cost, in the books.', from: 3, usedBy: ['Head office'] },
      { name: 'Invoicing', what: 'Bills sent and bills received.', from: 4, usedBy: ['Buying'], feeds: ['Bookkeeping'] },
      { name: 'Expenses', what: 'Receipts claimed back, and who approved them.', from: 5, usedBy: ['Cafés', 'Head office'], feeds: ['Bookkeeping'] },
      { name: 'Budgets', what: 'What each part of the company plans to spend.', from: 6, usedBy: ['Head office', 'Buying', 'Marketing'], feeds: ['Dashboards'] },
    ],
  },
  {
    name: 'People',
    what: 'Hiring, contracts and pay.',
    x: 330, y: 410,
    people: [0, 0, 0, 1, 2, 2],
    systems: [
      { name: 'Payroll', what: 'Wages paid, with tax taken off and sent on.', from: 2, everyone: true, feeds: ['Bookkeeping', 'Pensions'] },
      { name: 'Insurance', what: 'The cover an employer has to have before anyone starts.', from: 2 },
      { name: 'Contracts', what: 'What each person was hired to do, and on what terms.', from: 2, everyone: true, feeds: ['HR system'] },
      { name: 'Hiring', what: 'Jobs advertised, applicants, interviews and offers.', from: 4, usedBy: ['Cafés'], feeds: ['HR system'] },
      { name: 'Training', what: 'Who has learned what, from making a flat white to fire safety.', from: 4, everyone: true, feeds: ['HR system'] },
      { name: 'Pensions', what: 'What everyone has put aside, with which provider.', from: 4 },
      { name: 'HR system', what: 'Who works here, on what terms, and their holidays.', from: 5, everyone: true, feeds: ['Payroll', 'Logins'] },
    ],
  },
  {
    name: 'Head office',
    what: 'The people running the company.',
    x: 470, y: 120,
    people: [0, 0, 0, 1, 2, 2],
    systems: [
      { name: 'Dashboards', what: 'Sales, costs and people, every morning.', from: 5, usedBy: ['Cafés', 'Finance', 'Buying', 'Marketing'] },
    ],
  },
  {
    name: 'IT',
    what: 'The people looking after all of the systems.',
    x: 820, y: 290,
    people: [0, 0, 0, 0, 1, 2],
    systems: [
      { name: 'Email', what: 'Email, calendars and shared files.', from: 4, everyone: true },
      { name: 'Logins', what: 'Who may use which system.', from: 5, everyone: true },
      { name: 'Laptops', what: 'Every laptop and phone the company owns, kept up to date.', from: 5 },
      { name: 'IT help desk', what: 'Everything that has stopped working, and who is fixing it.', from: 6, usedBy: ['Cafés'] },
      { name: 'Backups', what: 'Copies of everything, somewhere else.', from: 6 },
    ],
  },
  {
    name: 'Marketing',
    what: 'Campaigns, the menu, and the loyalty scheme.',
    x: 200, y: 260,
    people: [0, 0, 0, 0, 2, 3],
    systems: [
      { name: 'Website', what: 'The pages about the company, the menu and the cafés.', from: 4 },
      { name: 'Loyalty', what: 'Points, rewards, and who has them.', from: 5, usedBy: ['Cafés'], feeds: ['Customer records'] },
      { name: 'Email campaigns', what: 'Offers sent to customers who asked for them.', from: 5 },
      { name: 'Menu boards', what: 'The screens above the counter, in every café.', from: 6, usedBy: ['Cafés'] },
      { name: 'Customer records', what: 'Everyone who has bought, and what they agreed to.', from: 6, usedBy: ['Customer service'], feeds: ['Email campaigns'] },
    ],
  },
  {
    name: 'App',
    what: 'The app, and the people building it.',
    x: 830, y: 470,
    people: [0, 0, 0, 0, 0, 3],
    systems: [
      { name: 'App', what: 'Order ahead, pay, collect points.', from: 6, feeds: ['Online orders', 'Customer logins'] },
      { name: 'Online orders', what: 'Every order from the app, and where it is.', from: 6, usedBy: ['Cafés', 'Customer service'], feeds: ['Kitchen screens', 'Till', 'Deliveries'] },
      { name: 'Customer logins', what: 'Customers’ logins, addresses and saved cards.', from: 6, feeds: ['Customer records'] },
      { name: 'Offers', what: 'Discount codes and promotions, and who may use them.', from: 6, usedBy: ['Marketing'], feeds: ['Till', 'App'] },
      { name: 'Delivery apps', what: 'Orders arriving from someone else’s app.', from: 6, usedBy: ['Cafés'], feeds: ['Kitchen screens', 'Till'] },
    ],
  },
  {
    name: 'Customer service',
    what: 'The customers who get in touch.',
    x: 520, y: 500,
    people: [0, 0, 0, 0, 0, 2],
    systems: [
      { name: 'Service desk', what: 'Every question and complaint, and the answer.', from: 6 },
      { name: 'Refunds', what: 'Money going back, the way it came in.', from: 6, feeds: ['Card payments', 'Bookkeeping'] },
      { name: 'Phones', what: 'Calls queued, answered and recorded.', from: 6 },
    ],
  },
  {
    name: 'Legal',
    what: 'Contracts with suppliers and landlords, and the rules.',
    x: 930, y: 380,
    people: [0, 0, 0, 0, 0, 1],
    systems: [
      { name: 'Leases and contracts', what: 'Every agreement, with whom, until when.', from: 6, usedBy: ['Finance', 'Buying'] },
      { name: 'Data requests', what: 'Customers asking for their data, or for it to be deleted.', from: 6, feeds: ['Customer records'] },
    ],
  },
];

export const serviceById = Object.fromEntries(services.map((s) => [s.id, s])) as Record<string, Service>;
export const contractById = Object.fromEntries(contracts.map((c) => [c.id, c])) as Record<string, Contract>;
