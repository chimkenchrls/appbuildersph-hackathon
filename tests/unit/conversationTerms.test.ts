import { findBudget, findDuration, findRevisionTerms } from '@/safety/conversationTerms';

describe('findBudget', () => {
  test.each([
    ['The proposed fee is PHP 15,000.', 15000],
    ['Budget: ₱28,000', 28000],
    ['We can pay 15000 pesos', 15000],
    ['around P15,000 for the site', 15000],
    ['15k PHP all in', 15000],
    ['PHP 7,000.50 total', 7000.5],
    ['It will cost $2,000', 2000],
  ])('reads %p', (text, amount) => {
    expect(findBudget(text)?.amount).toBe(amount);
  });

  test('prefers the total over a deposit or balance', () => {
    const text = '50% downpayment of PHP 7,500, balance on delivery. Total project fee is PHP 15,000.';
    expect(findBudget(text)?.amount).toBe(15000);
  });

  test('a deposit alone is not the budget', () => {
    expect(findBudget('Please send the deposit of PHP 5,000 first.')).toBeNull();
    expect(findBudget('Hosting is PHP 500 per month.')).toBeNull();
  });

  test('two unexplained figures are left for the freelancer', () => {
    expect(findBudget('PHP 10,000 for design and PHP 5,000 for the build')).toBeNull();
  });

  test('no figure means no budget', () => {
    expect(findBudget('We need five pages and a contact form.')).toBeNull();
    expect(findBudget('Call me at 0917 123 4567')).toBeNull();
  });
});

describe('findDuration', () => {
  test.each([
    ['delivered in 2 weeks', 14],
    ['we need it in two weeks', 14],
    ['timeline is a month', 30],
    ['ready in 10 days', 10],
    ['about 2-3 weeks', 21],
    ['in a fortnight please', 14],
    ['three working days', 3],
  ])('reads %p', (text, days) => {
    expect(findDuration(text)?.days).toBe(days);
  });

  test('payment terms and warranties are not the delivery time', () => {
    expect(findDuration('Payment terms: 30 days after invoice.')).toBeNull();
    expect(findDuration('Net 30 days. Support for 2 weeks after launch.')).toBeNull();
    expect(findDuration('Payment within 7 days. Delivery in 3 weeks.')?.days).toBe(21);
  });

  test('nothing stated means nothing recorded', () => {
    expect(findDuration('Five pages and a contact form.')).toBeNull();
  });
});

describe('findRevisionTerms', () => {
  test.each([
    ['two rounds of revisions are included', '2 rounds of revisions included.'],
    ['two revision rounds are included', '2 rounds of revisions included.'],
    ['2 revisions included', '2 rounds of revisions included.'],
    ['one round of changes is fine', '1 round of revisions included.'],
    ['includes 3 design revisions', '3 rounds of revisions included.'],
    ['unlimited revisions until you are happy', 'Unlimited revisions included.'],
  ])('reads %p', (text, expected) => {
    expect(findRevisionTerms(text)).toBe(expected);
  });

  test('a page count is not a revision count', () => {
    expect(findRevisionTerms('five pages with revisions to be discussed')).toBeNull();
    expect(findRevisionTerms('Five pages and two rounds of revisions')).toBe('2 rounds of revisions included.');
  });
});
