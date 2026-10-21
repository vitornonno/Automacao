(function messageModule(global) {
  'use strict';

  function hours(value) { return Number.isInteger(value) ? String(value) : Number(value).toFixed(1); }
  function greeting(name) { return name ? `Hi ${name},` : 'Hi,'; }
  function homeDetails(lead) {
    const items = [];
    if (lead.bedrooms || lead.bathrooms) items.push(`🏠 Home: ${lead.bedrooms || '?'} Bedrooms / ${lead.bathrooms || '?'} Bathrooms`);
    if (lead.squareFeet) items.push(`📐 Approximate Size: ${lead.squareFeet} sq. ft.`);
    if (lead.cleaningProducts) items.push(`🍃 Cleaning Products: ${lead.cleaningProducts}`);
    if (lead.extraServices && !/^not sure$/i.test(String(lead.extraServices).trim())) items.push(`🧽 Additional Services Requested: ${lead.extraServices}`);
    return items;
  }
  function hourlyEstimate(quote) {
    return [
      'For this service, we recommend hourly pricing because the amount of time needed can vary depending on the home’s condition and the level of detail required.',
      '',
      '💲 Rate: $50 per cleaner, per hour',
      '👥 Team: 1-2 cleaning professionals, depending on availability and the scope of work',
      '',
      `Based on our experience with homes of similar size, this service typically takes approximately ${hours(quote.estimatedHours.minimum)} to ${hours(quote.estimatedHours.maximum)} hours with a 2-cleaner team, depending on the home’s condition.`,
      '',
      'Upon arrival, our team will perform a brief walkthrough of the property and provide a more accurate estimate of the expected cleaning time before work begins.'
    ];
  }
  function serviceLimitations(lead) {
    const requested = String(lead?.extraServices || '').toLowerCase();
    const notes = [];
    if (/carpet|rug/.test(requested)) {
      notes.push('⚠️ Please note that we do not provide professional carpet or rug shampoo/extraction cleaning, but we can vacuum carpeted areas and rugs as part of the service.');
    }
    if (/upholstery|sofa|couch/.test(requested)) {
      notes.push('⚠️ Please note that we do not provide professional upholstery cleaning.');
    }
    if (/pet\s*odor|odor.*pet/.test(requested)) {
      notes.push('⚠️ Please note that we do not provide specialized pet odor treatment or guaranteed odor removal, but we can thoroughly clean the affected areas and help reduce odors as part of the service.');
    }
    return notes;
  }
  function separatedParagraphs(items) {
    return items.flatMap((item, index) => index ? ['', item] : [item]);
  }
  function selectedAvailability(review) {
    const slots = Array.isArray(review?.availability) ? review.availability : [];
    if (!slots.length) return [];
    const date = (value) => new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(`${value}T12:00:00`));
    const time = (minutes) => {
      const hour = Math.floor(minutes / 60); const minute = minutes % 60;
      const suffix = hour >= 12 ? 'PM' : 'AM'; const twelveHour = hour % 12 || 12;
      return `${twelveHour}:${String(minute).padStart(2, '0')} ${suffix}`;
    };
    return ['📅 Current availability:', '', ...slots.map((slot) => `• ${date(slot.day)} | Arrival window: ${time(slot.start)}–${time(slot.start + 30)}`)];
  }
  function noAvailabilityFollowUp(review) {
    if (review?.availabilitySearch?.compatibleTotal !== 0) return [];
    return [
      '✨ We do not currently have a compatible opening in the schedule.',
      '🗓️ Could you please share your preferred days and times? We’ll do our best to find the closest available options.'
    ];
  }
  function kacsMessage(review) {
    const quote = review.quote;
    const lead = review.lead || {};
    const details = homeDetails(lead);
    const service = quote.service;
    const message = [greeting(lead.customerName), '', 'Thank you for reaching out to KACS Cleaning Services LLC!'];
    if (service === 'first_cleaning') {
      message.push('', "We'd be happy to help with your cleaning service. Since this would be your first cleaning with our company, we recommend starting with a First Cleaning. This initial visit allows us to become familiar with your home and establish a cleaning baseline before any future maintenance visits.");
    } else if (service === 'deep_cleaning') {
      message.push('', "We'd be happy to help with your one-time Deep Cleaning service.");
    } else if (service === 'move_in_out') {
      message.push('', "We'd be delighted to assist with your Move-In / Move-Out Cleaning. To make the estimate more accurate and fair, could you please confirm whether this is a move-in or move-out cleaning?");
    }
    if (details.length) message.push('', 'Based on the information you provided:', '', ...details);
    message.push('', `🧼 ${quote.serviceLabel.toUpperCase()}`, '', ...hourlyEstimate(quote));
    if (service === 'move_in_out') {
      message.push('', '✅ Our Move-In / Move-Out Cleaning includes:', '', '• Inside oven cleaning', '• Inside refrigerator cleaning', '• Interior cleaning of cabinets and drawers', '• Reachable interior window cleaning', '• Detailed cleaning of bathrooms, kitchen, bedrooms, and common areas');
    }
    const limitations = serviceLimitations(lead);
    if (limitations.length) message.push('', ...separatedParagraphs(limitations));
    const availability = selectedAvailability(review);
    if (availability.length) message.push('', ...availability);
    const noAvailability = noAvailabilityFollowUp(review);
    if (noAvailability.length) message.push('', ...noAvailability);
    message.push('', 'Please let us know if you have any questions or would like to discuss the next steps.', '', 'KACS Cleaning Services LLC', '🌐 www.kacscleaning.com', '📞 (925) 438-0657');
    return message.join('\n');
  }

  function missingSizeMessage(review) {
    const quote = review.quote || {};
    const lead = review.lead || {};
    const service = quote.serviceLabel || lead.serviceType || 'cleaning service';
    return [
      greeting(lead.customerName),
      '',
      'Thank you for reaching out to KACS Cleaning Services LLC!',
      '',
      `We’d be happy to help with your ${service}. To prepare an accurate estimate, could you please let us know how many bedrooms and bathrooms your home has?`,
      '',
      'If available, you are also welcome to share the approximate square footage or a few photos of the main areas.',
      '',
      'Once we have those details, we’ll be happy to provide the estimated service time and discuss the next steps.',
      '',
      'KACS Cleaning Services LLC',
      '🌐 www.kacscleaning.com',
      '📞 (925) 438-0657'
    ].join('\n');
  }

  function jheysMissingSizeMessage(review) {
    const lead = review.lead || {};
    return [
      greeting(lead.customerName),
      '',
      'Thank you for reaching out to Jhey’s Cleaning. 👋',
      '',
      'To prepare an accurate estimate for your home, could you kindly share the following details?',
      '• Approximate square footage',
      '• Number of bedrooms and bathrooms',
      '',
      'Photos or a short video of the main areas are also welcome, as they allow us to tailor the estimate more precisely.',
      '',
      'Best regards,',
      'Jhey’s Cleaning',
      '📞 (925) 515-5090'
    ].join('\n');
  }

  function jheysMessage(review) {
    const quote = review.quote || {};
    const lead = review.lead || {};
    const details = homeDetails(lead);
    const message = [
      greeting(lead.customerName),
      '',
      'Thank you for the information provided. Based on the details of your home, we recommend the following:'
    ];
    if (details.length) message.push('', ...details);
    message.push(
      '',
      `🧼 Recommended service: ${quote.serviceLabel || 'Cleaning'}`,
      `💲 Estimated investment: $${quote.priceRange?.minimum ?? quote.amount} to $${quote.priceRange?.maximum ?? Number(quote.amount || 0) + 100}`
    );
    if (quote.service === 'move_in_out') message.push('', 'To make this estimate more accurate and fair, could you please confirm whether the service is for a move-in or move-out?');
    const limitations = serviceLimitations(lead);
    if (limitations.length) message.push('', ...separatedParagraphs(limitations));
    const availability = selectedAvailability(review);
    if (availability.length) message.push('', ...availability);
    message.push(
      '',
      '👥 Team: 2 professional cleaners',
      '',
      'This first visit provides a thorough foundation, allowing future appointments to be more efficient, consistent, and budget-friendly.',
      'Upon arrival, our team will complete a quick walkthrough to confirm the scope of work and final price before beginning.',
      ...(noAvailabilityFollowUp(review).length ? ['', ...noAvailabilityFollowUp(review)] : []),
      '',
      'Please let us know if you would like to proceed or have any questions.',
      '',
      'Best regards,',
      'Jhey’s Cleaning',
      '📞 (925) 515-5090'
    );
    return message.join('\n');
  }

  function approvedMessage(review) {
    const quote = review.quote || {};
    if (quote.company === 'kacs' && quote.status === 'missing_size') return missingSizeMessage(review);
    if (quote.company === 'kacs' && quote.estimatedHours) {
      return kacsMessage(review);
    }
    if (quote.company === 'jheys' && quote.status === 'missing_size') return jheysMissingSizeMessage(review);
    if (quote.company === 'jheys' && quote.amount) return jheysMessage(review);
    return 'This lead needs a manual review before a message can be prepared.';
  }

  global.CleaningQuoteMessages = { approvedMessage };
  if (typeof module !== 'undefined') module.exports = global.CleaningQuoteMessages;
})(globalThis);
