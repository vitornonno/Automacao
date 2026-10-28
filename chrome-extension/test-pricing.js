const engine = require('./pricing.js');
const extractor = require('./extractors.js');
const messages = require('./quote-messages.js');
const fs = require('fs');

function check(condition, message) { if (!condition) throw new Error(message); }
let quote = engine.calculateQuote({ companyName: 'KACS Cleaning Services LLC', squareFeet: 850, serviceType: 'Deep Cleaning' });
check(quote.quoteType === 'time_only', 'KACS must return an hours-only quote');
check(quote.size.band === 1000 && quote.baseHours === 2.5 && quote.estimatedHours.maximum === 4, 'KACS 850 sq. ft. deep clean should map to 1,000 sq. ft.');
check(!Object.hasOwn(quote, 'amount'), 'KACS must not calculate a dollar total');
quote = engine.calculateQuote({ companyName: "Jhey's Cleaning", bedrooms: 3, bathrooms: 2, serviceType: 'Monthly Cleaning' });
check(quote.size.band === 1600 && quote.amount === 195 && quote.priceRange.minimum === 195 && quote.priceRange.maximum === 295, 'Jhey’s prices must use the base amount plus a $100 range');
quote = engine.calculateQuote({ companyName: 'Jhey’s Cleaning Services', bedrooms: 4, bathrooms: 4, serviceType: 'Deep Cleaning' });
check(quote.company === 'jheys' && quote.status === 'ready_for_review', 'Jhey’s with a typographic apostrophe must be auto-detected');
quote = engine.calculateQuote({ companyName: "Jhey's Cleaning", bedrooms: 3, bathrooms: 3, serviceType: 'First Cleaning' });
check(quote.size.band === 1600 && quote.status === 'ready_for_review', '3 bedrooms / 3 bathrooms should use the conservative 1,600 sq. ft. band');
quote = engine.calculateQuote({ companyName: 'KACS', bedrooms: 3, bathrooms: 1, serviceType: 'Move-Out Cleaning' });
check(quote.size.band === 1600 && quote.size.source === 'bedrooms_bathrooms_conservative' && quote.estimatedHours.minimum === 5.5 && quote.estimatedHours.maximum === 7, 'An unmatched 3 bedrooms / 1 bathroom lead should use the closest conservative size band');
quote = engine.calculateQuote({ companyName: 'Other Company', bedrooms: 3, bathrooms: 2, serviceType: 'Monthly Cleaning' });
check(quote.status === 'manual_company_required', 'Unknown companies must not use Jhey\'s pricing automatically');
quote = engine.calculateQuote({ companyName: 'KACS', squareFeet: 3200, serviceType: 'Move-out Cleaning' });
check(quote.status === 'manual_hours_required' && quote.hourlyRate === 100, 'KACS above 3,000 sq. ft. requires human hours');
quote = engine.calculateQuote({ companyName: 'KACS', squareFeet: 800, serviceType: 'Move-in or move-out cleaning' });
check(quote.status === 'move_type_required' && quote.service === null, 'Combined Yelp move requests must require the VA to select Move-In or Move-Out');
quote = engine.calculateQuote({ companyName: 'KACS', squareFeet: 800, serviceType: 'Move-In Cleaning' });
check(quote.service === 'move_in' && quote.baseHours === 2.5 && quote.estimatedHours.maximum === 4, 'KACS Move-In estimates must use the dedicated table value');
quote = engine.calculateQuote({ companyName: 'KACS', squareFeet: 800, serviceType: 'Move-Out Cleaning' });
check(quote.service === 'move_out' && quote.baseHours === 3 && quote.estimatedHours.maximum === 4.5, 'KACS Move-Out estimates must use the dedicated table value');
check(engine.roundToNearestHalfHour(2.2) === 2 && engine.roundToNearestHalfHour(2.8) === 3 && engine.roundToNearestHalfHour(4) === 4, 'KACS hour estimates must round to the nearest whole or half-hour increment');
check(engine.normalizeService('Move-in or move-out cleaning') === 'move_in_out', 'Combined Yelp labels should be recognized so the UI can request the specific move type');
quote = engine.calculateQuote({ companyName: "Jhey's Cleaning", bedrooms: 3, bathrooms: 2, serviceType: 'Move-in or move-out cleaning' });
check(quote.status === 'move_type_required', 'Jhey’s combined move requests must require a specific move type');
quote = engine.calculateQuote({ companyName: "Jhey's Cleaning", bedrooms: 3, bathrooms: 2, serviceType: 'Move-Out Cleaning' });
check(quote.service === 'move_out' && quote.amount === 410 && quote.priceRange.maximum === 510, 'Jhey’s Move-Out quote must use its dedicated table value');
const configuredCompanies = ['KACS Cleaning Services', "Jhey's Cleaning", 'Da Silva Cleaning Services', 'UT Cleans', "Mary's House Cleaning", 'Gleam Team Housecleaning', 'Express House Cleaning'];
for (const companyName of configuredCompanies) {
  const lead = { companyName, squareFeet: 2230 };
  const moveIn = engine.calculateQuote({ ...lead, serviceType: 'Move-in Cleaning' });
  const moveOut = engine.calculateQuote({ ...lead, serviceType: 'Move-out Cleaning' });
  if (moveIn.company === 'kacs') {
    check(moveIn.baseHours === 7.5 && moveOut.baseHours === 8.5, `${companyName}: move estimates must use separate hours`);
  } else {
    check(moveIn.amount === 560 && moveOut.amount === 625, `${companyName}: move estimates must use separate prices`);
    check(messages.approvedMessage({ lead, quote: moveIn }).includes('560') && messages.approvedMessage({ lead, quote: moveOut }).includes('625'), `${companyName}: copied messages must include the selected price`);
  }
}
check(configuredCompanies.every((companyName) => {
  const moveQuote = engine.calculateQuote({ companyName, bedrooms: 3, bathrooms: 2, serviceType: 'Move-In Cleaning' });
  return moveQuote.status === 'ready_for_review' && moveQuote.service === 'move_in';
}), 'Selecting Move-In manually must unlock a quote for every configured company');
quote = engine.calculateQuote({ companyName: 'Gleam Team Housecleaning', bedrooms: 3, bathrooms: 2, serviceType: 'First Cleaning' });
check(quote.company === 'gleam' && quote.amount === 250 && quote.priceRange.maximum === 350 && !quote.discount, 'A blank discount field must preserve the regular Gleam price without mentioning a discount');
quote = engine.calculateQuote({ companyName: 'Gleam Team Housecleaning', bedrooms: 3, bathrooms: 2, serviceType: 'Move-In Cleaning' });
check(quote.service === 'move_in' && quote.amount === 365 && !quote.discount, 'Gleam Move-In must use its regular price when no discount is selected');
quote = engine.calculateQuote({ companyName: 'Gleam Team Housecleaning', bedrooms: 3, bathrooms: 2, serviceType: 'Move-Out Cleaning' });
check(quote.service === 'move_out' && quote.amount === 410 && !quote.discount, 'Gleam Move-Out must remain separate without a selected discount');
quote = engine.calculateQuote({ companyName: "Mary's House Cleaning", bedrooms: 3, bathrooms: 2, serviceType: 'Deep Cleaning' }, { discountPercent: 10, discountTarget: 'deep_cleaning' });
check(quote.amount === 295 && quote.discount?.percentage === 10, 'A selected discount must apply to the matching primary cleaning type and round up to $5');
check(quote.priceRange.maximum === 385, 'The discount must apply to both ends of the original price range');
for (const [serviceType, expectedMin, expectedMax] of [['Move-in Cleaning', 292, 372], ['Move-out Cleaning', 328, 408]]) {
  const discounted = engine.calculateQuote({ companyName: "Jhey's Cleaning", squareFeet: 1500, serviceType }, { discountPercent: 20 });
  check(discounted.priceRange.minimum === Math.ceil(expectedMin / 5) * 5 && discounted.priceRange.maximum === Math.ceil(expectedMax / 5) * 5, `${serviceType} must receive the percentage without a separate discount target`);
}
for (const companyName of configuredCompanies.filter((name) => name !== 'KACS Cleaning Services')) {
  const lead = { companyName, squareFeet: 1600, serviceType: 'Deep Cleaning' };
  const freeQuote = engine.calculateQuote(lead, { discountPercent: 100, discountTarget: 'deep_cleaning' });
  const message = messages.approvedMessage({ lead, quote: freeQuote });
  check(freeQuote.priceRange.minimum === 0 && freeQuote.priceRange.maximum === 0 && message.includes('$0'), `${companyName}: 100% discount must result in a usable $0 quote`);
}
for (const companyName of configuredCompanies) {
  const large = engine.calculateQuote({ companyName, bedrooms: 10, bathrooms: 8, serviceType: 'Deep Cleaning' });
  check(['manual_quote_required', 'manual_hours_required'].includes(large.status) && !large.size.band, `${companyName}: unmatched home dimensions must require manual review`);
}
const maryDiscountMessage = messages.approvedMessage({ lead: {}, quote });
check(!maryDiscountMessage.includes('first-cleaning price'), 'A discounted deep cleaning must not be described as First Cleaning');
quote = engine.calculateQuote({ companyName: "Jhey's Cleaning", bedrooms: 3, bathrooms: 2, serviceType: 'Regular home cleaning', frequency: 'Biweekly' }, { discountPercent: 20, discountTarget: 'regular' });
check(quote.amount === 250 && quote.recurringCleaning?.priceRange?.minimum === 140 && quote.recurringCleaning?.priceRange?.maximum === 160 && quote.recurringCleaning?.discount?.percentage === 20, 'A regular-cleaning discount must apply only to the recurring rate');
quote = engine.calculateQuote({ companyName: "Jhey's Cleaning", bedrooms: 3, bathrooms: 2, serviceType: 'Regular home cleaning', frequency: 'Every 2 weeks' }, { discountPercent: 10, discountTarget: 'first_cleaning' });
check(quote.amount === 250 && !quote.discount && quote.recurringCleaning?.priceRange?.minimum === 170 && quote.recurringCleaning?.priceRange?.maximum === 200 && quote.recurringCleaning?.firstRecurringDiscount?.priceRange?.minimum === 155 && quote.recurringCleaning?.firstRecurringDiscount?.priceRange?.maximum === 180, 'A First Cleaning discount on a recurring request must apply only to the first regular visit');
quote = engine.calculateQuote({ companyName: "Jhey's Cleaning", bedrooms: 3, bathrooms: 2, serviceType: 'Regular home cleaning', frequency: 'Every 2 weeks' }, { discountPercent: 10 });
check(quote.recurringCleaning?.firstRecurringDiscount?.percentage === 10, 'A filled discount percentage without a target should default to the service currently being quoted');
for (const companyName of configuredCompanies) {
  const lead = { companyName, bedrooms: 4, bathrooms: 3, serviceType: 'Regular home cleaning', frequency: 'Every 2 weeks' };
  const discounted = engine.calculateQuote(lead, { discountPercent: 20 });
  check(discounted.recurringCleaning?.firstRecurringDiscount?.percentage === 20, `${companyName}: First Cleaning discount must apply to the first recurring appointment`);
  check(messages.approvedMessage({ lead, quote: discounted }).includes('20% new customer discount on your first bi-weekly regular cleaning'), `${companyName}: recurring discount must appear in the message`);
}
const weeklyDiscountLead = { companyName: "Jhey's Cleaning", bedrooms: 3, bathrooms: 2, serviceType: 'Regular home cleaning', frequency: 'Weekly' };
const weeklyDiscountQuote = engine.calculateQuote(weeklyDiscountLead, { discountPercent: 10 });
check(weeklyDiscountQuote.recurringCleaning?.firstRecurringDiscount?.percentage === 10 && !weeklyDiscountQuote.recurringCleaning?.priceRange && messages.approvedMessage({ lead: weeklyDiscountLead, quote: weeklyDiscountQuote }).includes('10% new customer discount on your first weekly regular cleaning'), 'Weekly discounts must be explained without inventing a recurring price');
check(engine.resolveCompany('Da Silva Cleaning Services') === 'dasilva' && engine.resolveCompany('Express House Cleaning') === 'express' && engine.resolveCompany('UT Cleans') === 'utcleans' && engine.resolveCompany("Mary's House Cleaning") === 'marys', 'All configured company names must be auto-detected');
check(engine.resolveCompany('Gleam Team') === 'gleam' && engine.resolveCompany('DaSilva Cleaning') === 'dasilva', 'Yelp short business names must be auto-detected');
check(engine.resolveService('Regular home cleaning', 'Once') === 'first_cleaning', 'One-time regular cleaning should map to First Cleaning');
check(engine.resolveService('Regular home cleaning', 'Biweekly') === 'first_cleaning', 'Recurring new leads should start with First Cleaning');
check(engine.resolveService('Regular home cleaning', 'Weekly') === 'first_cleaning', 'Weekly new leads should start with First Cleaning');
quote = engine.calculateQuote({ companyName: "Jhey's Cleaning", bedrooms: 3, bathrooms: 2, serviceType: 'Regular home cleaning', frequency: 'Biweekly' });
check(quote.service === 'first_cleaning' && quote.recurringCleaning?.label === 'Bi-weekly' && quote.recurringCleaning?.priceRange?.minimum === 170 && quote.recurringCleaning?.priceRange?.maximum === 200, 'Regular bi-weekly leads should retain the First Cleaning quote and add the table-based recurring range');
quote = engine.calculateQuote({ companyName: "Jhey's Cleaning", bedrooms: 4, bathrooms: 3, serviceType: 'Regular home cleaning', frequency: 'Every 2 weeks' });
check(quote.recurringCleaning?.label === 'Bi-weekly' && quote.recurringCleaning?.priceRange?.minimum === 260 && quote.recurringCleaning?.priceRange?.maximum === 290, 'Yelp Every 2 weeks must resolve to the bi-weekly table rate');
quote = engine.calculateQuote({ companyName: 'KACS', bedrooms: 3, bathrooms: 2, serviceType: 'Regular home cleaning', frequency: 'Weekly' });
check(quote.recurringCleaning?.label === 'Weekly' && !quote.recurringCleaning?.priceRange, 'Weekly regular leads should defer the recurring rate until after the First Cleaning');
const yelpSource = fs.readFileSync('../docs/codigo_fonte_KACS_yelpLeads.txt', 'utf8');
const yelpState = extractor.yelpApolloStateFromScripts([{ textContent: yelpSource }]);
check(yelpState, 'The Yelp Apollo state should parse from the saved source');
const yelpLead = extractor.extractYelpLeadFromState(yelpState, '/leads_center/FAHbiW72jLTiNDvcOptrfg/leads/N_elcsrAMm0NNcBkVgp1Yw');
check(yelpLead?.companyName === 'KACS Cleaning Services' && yelpLead.bedrooms && yelpLead.bathrooms, 'Yelp lead details should be extracted from the active route');
check(extractor.firstName('Adrienne M.') === 'Adrienne', 'Only the first customer name should be used');
check(extractor.isCustomerName('Alejandra C.') && extractor.isCustomerName('Alejandra Castillo') && extractor.isCustomerName('Alejandra') && !extractor.isCustomerName('Contacted Lead Details'), 'Visible Yelp customer names must support first name, initials, and full names without accepting page headings');
const yelpBusinessCases = [
  ['Jhey’s Cleaning Services\nMy Leads', 'Jhey’s Cleaning Services'],
  ['KACS Cleaning Services LLC', 'KACS Cleaning Services'],
  ['DaSilva Cleaning', 'Da Silva Cleaning Services'],
  ['UT Cleans\nMy Leads', 'UT Cleans'],
  ["Mary's House Cleaning", "Mary's House Cleaning"],
  ['Gleam Team\nMy Leads', 'Gleam Team Housecleaning'],
  ['Express House Cleaning', 'Express House Cleaning']
];
check(yelpBusinessCases.every(([source, expected]) => extractor.yelpBusinessNameFromText(source) === expected), 'Every configured company must be recognized from Yelp DOM text');
for (const [index, [businessName]] of yelpBusinessCases.entries()) {
  const companyId = `company${index}`;
  const state = {
    [`Business:${companyId}`]: { __typename: 'Business', encid: companyId, name: businessName.split('\n')[0] },
    'Business:other': { __typename: 'Business', encid: 'other', name: 'KACS Cleaning Services' },
    'Lead:one': { __typename: 'Lead', encid: 'one', project: { __ref: 'Project:one' } },
    'Lead:two': { __typename: 'Lead', encid: 'two', project: { __ref: 'Project:two' } },
    'Project:one': { __typename: 'Project', jobSummaryTitle: 'Deep cleaning', user: { __ref: 'User:one' } },
    'Project:two': { __typename: 'Project', jobSummaryTitle: 'Deep cleaning', user: { __ref: 'User:two' } },
    'User:one': { displayName: 'Maria Silva' },
    'User:two': { displayName: 'João Pereira' }
  };
  const one = extractor.extractYelpLeadFromState(state, `/leads_center/${companyId}/leads/one`);
  const two = extractor.extractYelpLeadFromState(state, `/leads_center/${companyId}/leads/two`);
  check(engine.resolveCompany(one.companyName) === ['jheys', 'kacs', 'dasilva', 'utcleans', 'marys', 'gleam', 'express'][index], `${businessName}: Apollo business should resolve to the correct company`);
  check(one.customerName === 'Maria' && two.customerName === 'João', `${businessName}: customer names must come from the active lead`);
  delete state['User:one'].displayName;
  check(extractor.extractYelpLeadFromState(state, `/leads_center/${companyId}/leads/one`).customerName === null, `${businessName}: missing names must not be borrowed from another lead`);
}
const multiBusinessApolloState = {
  'Lead:target': { __typename: 'Lead', encid: 'target', business: { __ref: 'Business:ut' }, project: { __ref: 'Project:target' } },
  'Project:target': { __typename: 'Project', jobSummaryTitle: 'Deep cleaning', description: '', surveyQuestionAnswers: [] },
  'Business:wrong': { __typename: 'Business', name: 'KACS Cleaning Services' },
  'Business:ut': { __typename: 'Business', encid: 'ut', name: 'UT Cleans' }
};
check(extractor.extractYelpLeadFromState(multiBusinessApolloState, '/leads_center/ut/leads/target')?.companyName === 'UT Cleans', 'Apollo extraction must use the route business instead of the first cached business');
check(extractor.extractYelpLeadFromState(multiBusinessApolloState, '/leads_center/unknown/leads/target')?.companyName === null, 'Apollo extraction must not use a business unrelated to the current route');
check(extractor.squareFeetFromText('We have a townhome about 2000 sq ft.') === '2000', 'Yelp details should recognize square footage written before the unit');
check(extractor.surveyAnswer({ surveyQuestionAnswers: [{ question: 'Do you require any of these cleaning product types?', answers: ['Eco-friendly or green', 'Non-toxic', 'Pet-safe'] }] }, /cleaning product types/i) === 'Eco-friendly or green, Non-toxic, Pet-safe', 'All Yelp multi-select answers should be retained');
check(engine.calculateQuote(yelpLead).service === 'first_cleaning', 'The saved Yelp example should resolve Regular home cleaning / Once');
const individualYelpSource = fs.readFileSync('../docs/pagina_individual_leadsYelp.txt', 'utf8');
const individualYelpState = extractor.yelpApolloStateFromScripts([{ textContent: individualYelpSource }]);
const individualYelpLead = extractor.extractYelpLeadFromState(individualYelpState, '/leads_center/FAHbiW72jLTiNDvcOptrfg/leads/N_elcsrAMm0NNcBkVgp1Yw');
check(individualYelpLead?.frequency === 'Just once', 'Yelp individual pages should read frequency from survey answers');
check(engine.calculateQuote(individualYelpLead).service === 'first_cleaning', 'Yelp individual Regular home cleaning / Just once should map to First Cleaning');
const kacsMessage = messages.approvedMessage({ lead: { customerName: 'Sample', bedrooms: 2, bathrooms: 1 }, quote: { company: 'kacs', service: 'first_cleaning', serviceLabel: 'First Cleaning', estimatedHours: { minimum: 2, maximum: 3.5 } } });
check(kacsMessage.includes('Hi Sample,') && kacsMessage.includes('2-3.5 hours') && !kacsMessage.includes('$350'), 'KACS approval message should personalize the time estimate without a total');
const recurringMessage = messages.approvedMessage({ lead: { customerName: 'Sample' }, quote: { company: 'jheys', service: 'first_cleaning', serviceLabel: 'First Cleaning', amount: 250, recurringCleaning: { id: 'biweekly', label: 'Bi-weekly', priceRange: { minimum: 170, maximum: 200 } } } });
check(recurringMessage.includes('AFTER THE FIRST CLEANING — BI-WEEKLY REGULAR CLEANING') && recurringMessage.includes('approximately $170 - $200 per visit'), 'Recurring cleaning messages should show the table-based rate plus $30');
const noAutoDiscountMessage = messages.approvedMessage({ lead: { customerName: 'Sample' }, quote: { company: 'jheys', service: 'first_cleaning', serviceLabel: 'First Cleaning', amount: 250, recurringCleaning: { id: 'biweekly', label: 'Bi-weekly', priceRange: { minimum: 170, maximum: 200 } } } });
check(!noAutoDiscountMessage.includes('receives 10% off') && !noAutoDiscountMessage.includes('discount applied'), 'A recurring quote must not mention a discount unless the VA selected one');
const firstRecurringDiscountMessage = messages.approvedMessage({ lead: { customerName: 'Sample' }, quote: { company: 'jheys', service: 'first_cleaning', serviceLabel: 'First Cleaning', amount: 250, recurringCleaning: { id: 'biweekly', label: 'Bi-weekly', priceRange: { minimum: 170, maximum: 200 }, firstRecurringDiscount: { percentage: 10, priceRange: { minimum: 155, maximum: 180 }, standardPriceRange: { minimum: 170, maximum: 200 } } } } });
check(firstRecurringDiscountMessage.includes('new customer discount on your first bi-weekly regular cleaning: approximately $155 - $180 per visit') && firstRecurringDiscountMessage.includes('Future regular cleanings return to $170 - $200 per visit.'), 'A first-cleaning discount must explain the promotional first recurring visit and the normal future rate');
const weeklyRecurringMessage = messages.approvedMessage({ lead: { customerName: 'Sample' }, quote: { company: 'kacs', service: 'first_cleaning', serviceLabel: 'First Cleaning', estimatedHours: { minimum: 2, maximum: 3.5 }, recurringCleaning: { id: 'weekly', label: 'Weekly' } } });
check(weeklyRecurringMessage.includes('AFTER THE FIRST CLEANING — WEEKLY REGULAR CLEANING') && weeklyRecurringMessage.includes('The exact recurring rate will be confirmed after the First Cleaning.') && !weeklyRecurringMessage.includes('Weekly Regular Cleaning: approximately'), 'Weekly recurring messages should defer the rate until after the First Cleaning');
check(kacsMessage.includes('2 Bedrooms / 1 Bathroom'), 'Quote messages should use singular bathroom labels when the count is one');
const oneBedroomMessage = messages.approvedMessage({ lead: { customerName: 'Sample', bedrooms: 1, bathrooms: 1 }, quote: { company: 'jheys', serviceLabel: 'Deep Cleaning', amount: 200 } });
check(oneBedroomMessage.includes('1 Bedroom / 1 Bathroom'), 'Quote messages should use singular bedroom and bathroom labels when both counts are one');
const missingSizeMessage = messages.approvedMessage({ lead: { customerName: 'Sample', serviceType: 'Deep cleaning' }, quote: { company: 'kacs', status: 'missing_size', serviceLabel: 'Deep Cleaning' } });
check(missingSizeMessage.includes('Hi Sample,') && missingSizeMessage.includes('bedrooms and bathrooms') && missingSizeMessage.includes('Deep Cleaning'), 'KACS missing-size lead should request bedrooms and bathrooms');
const jheysMessage = messages.approvedMessage({ lead: { customerName: 'Marvin', bedrooms: 4, bathrooms: 4 }, quote: { company: 'jheys', serviceLabel: 'Deep Cleaning', amount: 900 } });
check(jheysMessage.includes('Hi Marvin,') && jheysMessage.includes('welcoming new clients') && jheysMessage.includes('Estimated investment: $900 to $1000') && !jheysMessage.includes('discount applied') && !jheysMessage.includes('quick walkthrough'), 'Jhey’s approval message should omit discounts when none are selected and avoid an arrival walkthrough or scope confirmation');
const gleamMessage = messages.approvedMessage({ lead: { customerName: 'Marvin' }, quote: { company: 'gleam', service: 'move_in', serviceLabel: 'Move-in Cleaning', amount: 310, priceRange: { minimum: 310, maximum: 410 }, discount: { percentage: 15 } } });
check(gleamMessage.includes('Gleam Team') && gleamMessage.includes('15% new customer discount applied') && gleamMessage.includes('$310–$410') && (gleamMessage.match(/15%/g) || []).length === 1, 'Gleam approval message must show the discount once');
const expressArchive = messages.archivingMessage('express', { customerName: 'Marvin' });
check(expressArchive.includes('Express House Cleaning') && expressArchive.includes('(510) 757-9573'), 'Express archiving message must use its script contact details');
const limitationsMessage = messages.approvedMessage({ lead: { customerName: 'Sample', bedrooms: 2, bathrooms: 1, extraServices: 'Pet odor treatment, Rug cleaning, Upholstery cleaning' }, quote: { company: 'kacs', service: 'deep_cleaning', serviceLabel: 'Deep Cleaning', estimatedHours: { minimum: 2, maximum: 3.5 } } });
check(limitationsMessage.includes('🧼 A quick note about the additional services requested:') && limitationsMessage.includes('• Professional rug shampoo/extraction cleaning is not included') && !limitationsMessage.includes('carpet or rug shampoo') && limitationsMessage.includes('• Professional upholstery cleaning is not included') && limitationsMessage.includes('• Specialized pet odor treatment and guaranteed odor removal are not included') && !limitationsMessage.includes('• we ') && !limitationsMessage.includes('⚠️ Please note'), 'Multiple requested limitations must use one softer grouped note');
const carpetAndRugMessage = messages.approvedMessage({ lead: { extraServices: 'Carpet cleaning, Rug cleaning' }, quote: { company: 'jheys', serviceLabel: 'First Cleaning', amount: 250 } });
check(carpetAndRugMessage.includes('professional carpet or rug shampoo/extraction cleaning, but we can vacuum carpeted areas and rugs'), 'A request for both carpet and rug cleaning should retain the combined limitation');
const singleLimitationMessage = messages.approvedMessage({ lead: { extraServices: 'Upholstery cleaning' }, quote: { company: 'jheys', serviceLabel: 'First Cleaning', amount: 250 } });
check(singleLimitationMessage.includes('⚠️ Please note that we do not provide professional upholstery cleaning.'), 'A single requested limitation should retain its direct individual note');
const jheysLimitationsMessage = messages.approvedMessage({ lead: { extraServices: 'Rug cleaning' }, quote: { company: 'jheys', serviceLabel: 'First Cleaning', amount: 250 } });
check(!jheysLimitationsMessage.includes('final price before beginning.\n\n\nPlease note'), 'Jhey’s limitation note must not create a double blank paragraph');
check(jheysLimitationsMessage.indexOf('Estimated investment') < jheysLimitationsMessage.indexOf('rug shampoo/extraction') && jheysLimitationsMessage.indexOf('rug shampoo/extraction') < jheysLimitationsMessage.indexOf('Team: 2'), 'Jhey’s limitations must appear immediately after the price range');
const jheysMissingSizeMessage = messages.approvedMessage({ lead: { customerName: 'Marvin' }, quote: { company: 'jheys', status: 'missing_size' } });
check(jheysMissingSizeMessage.includes('welcoming new clients') && jheysMissingSizeMessage.includes('Approximate square footage') && jheysMissingSizeMessage.includes('bedrooms and bathrooms'), 'Jhey’s missing-size lead should use a promotional tone while requesting home details');
const undecidedExtraServicesMessage = messages.approvedMessage({ lead: { extraServices: 'Not sure' }, quote: { company: 'jheys', serviceLabel: 'First Cleaning', amount: 250 } });
check(!undecidedExtraServicesMessage.includes('Additional Services Requested'), 'Unspecified additional services should not appear in the message');
const noAvailabilityMessage = messages.approvedMessage({ availabilitySearch: { compatibleTotal: 0 }, lead: { customerName: 'Sample' }, quote: { company: 'kacs', service: 'first_cleaning', serviceLabel: 'First Cleaning', estimatedHours: { minimum: 2, maximum: 3.5 } } });
check(noAvailabilityMessage.includes('To help us find the best opening for you') && noAvailabilityMessage.includes('📅 Which day of the week works best') && !noAvailabilityMessage.includes('📞 And please confirm if this is the best phone number') && noAvailabilityMessage.includes('closest available options') && !noAvailabilityMessage.includes('compatible opening'), 'No compatible availability should request scheduling details without asking for an unavailable phone number');
const noAvailabilityWithPhoneMessage = messages.approvedMessage({ availabilitySearch: { compatibleTotal: 0 }, lead: { customerName: 'Sample', phoneNumber: '+15551234567' }, quote: { company: 'kacs', service: 'first_cleaning', serviceLabel: 'First Cleaning', estimatedHours: { minimum: 2, maximum: 3.5 } } });
check(noAvailabilityWithPhoneMessage.includes('📞 And please confirm if this is the best phone number'), 'An explicitly linked Yelp phone number should trigger the phone confirmation request');
const squareFeetOnlyRequest = messages.detailsRequestMessage({ customerName: 'Sample' }, 'kacs', ['squareFeet']);
check(squareFeetOnlyRequest.includes('Approximate square footage') && !squareFeetOnlyRequest.includes('Number of bedrooms') && !squareFeetOnlyRequest.includes('Number of bathrooms'), 'Manual details requests should ask only for the selected fields');
const detailedJheysRequest = messages.detailsRequestMessage({ customerName: 'Sample' }, 'jheys', ['bedrooms', 'bathrooms', 'photos']);
check(detailedJheysRequest.includes('Thank you for reaching out to Jhey’s Cleaning!') && detailedJheysRequest.includes('Number of bedrooms') && detailedJheysRequest.includes('A few photos of the main areas'), 'Manual details requests should support selected Jhey’s details');
let followUps = messages.followUpStatus('kacs', { customerName: 'Sample' }, 'Earlier chat content');
check(followUps.length === 4 && followUps.every((followUp) => !followUp.sent) && followUps[0].message.includes('Hi Sample, this is Frank') && followUps[3].message.includes('KACS Cleaning Services -- just reaching out again'), 'A new KACS conversation should make all four follow-up situations available');
check(followUps[0].message.includes('this is Frank from KACS Cleaning.') && followUps[0].message.includes('I just wanted to follow up') && !followUps[0].message.includes('tried giving you a quick call'), 'KACS follow-up 1 should use the no-phone variation when no linked phone exists');
followUps = messages.followUpStatus('kacs', { customerName: 'Sample', phoneNumber: '+15551234567' }, 'Earlier chat content');
check(followUps[0].message.includes('I tried giving you a quick call'), 'KACS follow-up 1 should retain the call variation when a linked phone exists');
followUps = messages.followUpStatus('kacs', { customerName: 'Sample' }, "I just wanted to follow up in case you're still looking for help with your home cleaning.");
check(followUps[0].sent, 'KACS no-phone follow-up 1 should be detected as already sent');
followUps = messages.followUpStatus('jheys', { customerName: 'Sample' }, 'I wanted to check whether you are still considering options for your home cleaning. I wanted to follow up once more regarding the estimate we shared with you.');
check(followUps[0].sent && !followUps[1].sent && followUps[2].sent && !followUps[3].sent && followUps[0].message.includes('this is Frank following up.') && followUps[1].message.includes('Frank from Jhey’s Cleaning once again.') && followUps[2].message.includes('Frank from Jhey’s Cleaning.') && followUps[3].message.includes("Frank from Jhey's Cleaning"), 'Jhey’s follow-ups should identify Frank and detect each already-sent situation independently');
const daSilvaFollowUps = messages.followUpStatus('dasilva', { customerName: 'Sample' }, 'Estimated Price: $250–$350');
check(daSilvaFollowUps.situations.length === 4 && daSilvaFollowUps.situations.every((situation) => situation.messages.length === 3) && daSilvaFollowUps.suggestedSituation === 1, 'Da Silva must offer three follow-ups for each of its four chat situations');
const gleamFollowUps = messages.followUpStatus('gleam', { customerName: 'Sample' }, 'Please share the approximate square footage and photos of the main areas.');
check(gleamFollowUps.suggestedSituation === 2 && gleamFollowUps.situations[1].messages[0].message.includes('walkthrough video'), 'Gleam must identify a details-request chat and retain its situation-specific script');
const expressFollowUps = messages.followUpStatus('express', { customerName: 'Sample' }, 'Approximate square footage\nEstimated price: $200–$300');
check(expressFollowUps.suggestedSituation === 4 && expressFollowUps.situations[3].messages[2].message.includes('plans have changed'), 'Express must identify a quote that followed requested details and retain all follow-up stages');
check(messages.archivingMessage('kacs', { customerName: 'Sample' }).includes('Hi Sample!') && messages.archivingMessage('kacs', { customerName: 'Sample' }).includes('(925) 438-0657'), 'KACS archiving message should use the configured client greeting and contact details');
check(messages.archivingMessage('jheys', { customerName: 'Sample' }).includes("Hi Sample, thank you again for reaching out to Jhey's Cleaning.") && messages.archivingMessage('jheys', { customerName: 'Sample' }).includes('(925) 515-5090'), 'Jhey’s archiving message should use the configured client greeting and contact details');
console.log('Pricing logic checks passed.');
