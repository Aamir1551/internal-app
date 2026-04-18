// Mirror of the main app's kind registry with the editable field list used
// by the pending and directory edit pages.

export type KindId =
  | 'restaurant' | 'event' | 'club' | 'business' | 'tradesperson' | 'person'
  | 'school' | 'announcement' | 'interesting_fact' | 'place_of_worship'
  | 'opportunity' | 'activity' | 'menu_item';

export type FieldType = 'text' | 'textarea' | 'bool' | 'number';
export type KindField = { key: string; label: string; type?: FieldType };

export type KindSpec = {
  id: KindId;
  table: string;
  label: string;
  plural: string;
  emoji: string;
  titleField: string;
  secondaryField?: string;
  fields: KindField[];
};

const text = (key: string, label?: string): KindField => ({ key, label: label ?? titleCase(key) });
const long = (key: string, label?: string): KindField => ({ key, label: label ?? titleCase(key), type: 'textarea' });
const bool = (key: string, label?: string): KindField => ({ key, label: label ?? titleCase(key), type: 'bool' });
const num = (key: string, label?: string): KindField => ({ key, label: label ?? titleCase(key), type: 'number' });

function titleCase(key: string) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export const KINDS: Record<KindId, KindSpec> = {
  restaurant: {
    id: 'restaurant', table: 'rag_restaurants', label: 'Restaurant', plural: 'Restaurants', emoji: '🍴',
    titleField: 'name', secondaryField: 'cuisine',
    fields: [
      text('name'), text('slug'), text('cuisine'), text('address'), text('phone'),
      long('opening_hours'), text('website'), bool('halal'), bool('delivery'),
      num('rating'), long('description'),
    ],
  },
  event: {
    id: 'event', table: 'rag_events', label: 'Event', plural: 'Events', emoji: '📅',
    titleField: 'title', secondaryField: 'location',
    fields: [
      text('title'), text('date'), text('time'), text('location'),
      text('organizer'), text('ticket_price'), long('description'), text('contact'),
    ],
  },
  club: {
    id: 'club', table: 'rag_clubs', label: 'Club', plural: 'Clubs', emoji: '👥',
    titleField: 'name', secondaryField: 'type',
    fields: [
      text('name'), text('type'), text('meeting_day'), text('meeting_time'),
      text('location'), text('address'), text('age_group'), text('contact'),
      long('description'),
    ],
  },
  business: {
    id: 'business', table: 'rag_businesses', label: 'Business', plural: 'Businesses', emoji: '🏪',
    titleField: 'name', secondaryField: 'category',
    fields: [
      text('name'), text('category'), text('address'), text('phone'), text('website'),
      long('opening_hours'), num('rating'), long('description'),
    ],
  },
  tradesperson: {
    id: 'tradesperson', table: 'rag_tradespeople', label: 'Tradesperson', plural: 'Tradespeople', emoji: '🔧',
    titleField: 'name', secondaryField: 'trade',
    fields: [
      text('name'), text('trade'), text('phone'), text('address'), text('website'),
      text('area_covered'), text('rate'), text('availability'),
      bool('emergency'), text('qualifications'), num('rating'),
      long('description'), long('notes'),
    ],
  },
  person: {
    id: 'person', table: 'rag_people', label: 'Person', plural: 'People', emoji: '👤',
    titleField: 'name', secondaryField: 'role',
    fields: [text('name'), text('role'), text('organization'), text('phone'), text('email'), long('bio')],
  },
  school: {
    id: 'school', table: 'rag_schools', label: 'School', plural: 'Schools', emoji: '🎓',
    titleField: 'name', secondaryField: 'type',
    fields: [
      text('name'), text('type'), text('address'), text('phone'),
      text('head_teacher'), text('website'), text('ofsted_rating'),
    ],
  },
  announcement: {
    id: 'announcement', table: 'rag_announcements', label: 'Announcement', plural: 'Announcements', emoji: '📢',
    titleField: 'title', secondaryField: 'category',
    fields: [
      text('title'), long('body'), text('category'), text('date'),
      text('posted_by'), text('contact'),
    ],
  },
  interesting_fact: {
    id: 'interesting_fact', table: 'rag_interesting_facts', label: 'Interesting Fact', plural: 'Interesting Facts', emoji: '💡',
    titleField: 'title', secondaryField: 'category',
    fields: [text('title'), long('body'), text('category'), text('source')],
  },
  place_of_worship: {
    id: 'place_of_worship', table: 'rag_places_of_worship', label: 'Place of Worship', plural: 'Places of Worship', emoji: '🕌',
    titleField: 'name', secondaryField: 'type',
    fields: [
      text('name'), text('type'), text('address'), text('postcode'),
      text('phone'), text('website'), long('service_times'),
      long('facilities'), long('description'),
    ],
  },
  opportunity: {
    id: 'opportunity', table: 'rag_opportunities', label: 'Opportunity', plural: 'Opportunities', emoji: '💼',
    titleField: 'title', secondaryField: 'organization',
    fields: [
      text('type'), text('title'), text('organization'), text('category'),
      long('description'), text('location'), text('salary_range'), text('hours'),
      text('contact_email'), text('contact_phone'), text('website'), text('deadline'),
    ],
  },
  activity: {
    id: 'activity', table: 'rag_activities', label: 'Activity', plural: 'Activities', emoji: '🎯',
    titleField: 'name', secondaryField: 'category',
    fields: [
      text('name'), text('category'), long('description'), text('address'),
      text('postcode'), text('website'), text('phone'), long('opening_hours'),
      text('price_text'), text('age_group'), bool('suitable_for_kids'), bool('indoor'),
    ],
  },
  menu_item: {
    id: 'menu_item', table: 'rag_menu_items', label: 'Menu Item', plural: 'Menu Items', emoji: '🍽️',
    titleField: 'name', secondaryField: 'price_text',
    fields: [
      text('name'), long('description'), text('price_text'),
      num('price_min'), num('price_max'), bool('is_range'), bool('halal'),
      text('restaurant_id'),
    ],
  },
};

export const KIND_ORDER: KindId[] = [
  'restaurant', 'event', 'club', 'business', 'tradesperson', 'person',
  'school', 'announcement', 'interesting_fact', 'place_of_worship',
  'opportunity', 'activity', 'menu_item',
];

export function kindFromTable(table: string): KindSpec | null {
  return Object.values(KINDS).find((k) => k.table === table) ?? null;
}
