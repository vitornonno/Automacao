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
      `Based on our experience with homes of similar size, this service typically takes approximately ${hours(quote.estimatedHours.minimum)}-${hours(quote.estimatedHours.maximum)} hours with a 2-cleaner team, depending on the home’s condition.`,
      '',
      'Upon arrival, our team will perform a brief walkthrough of the property and provide a more accurate estimate of the expected cleaning time before work begins.'
    ];
  }
  function serviceLimitations(lead) {
    const requested = String(lead?.extraServices || '').toLowerCase();
    const notes = [];
    const requestsCarpet = /carpet/.test(requested);
    const requestsRug = /rug/.test(requested);
    if (requestsCarpet && requestsRug) {
      notes.push('⚠️ Please note that we do not provide professional carpet or rug shampoo/extraction cleaning, but we can vacuum carpeted areas and rugs as part of the service.');
    } else if (requestsCarpet) {
      notes.push('⚠️ Please note that we do not provide professional carpet shampoo/extraction cleaning, but we can vacuum carpeted areas as part of the service.');
    } else if (requestsRug) {
      notes.push('⚠️ Please note that we do not provide professional rug shampoo/extraction cleaning, but we can vacuum rugs as part of the service.');
    }
    if (/upholstery|sofa|couch/.test(requested)) {
      notes.push('⚠️ Please note that we do not provide professional upholstery cleaning.');
    }
    if (/pet\s*odor|odor.*pet/.test(requested)) {
      notes.push('⚠️ Please note that we do not provide specialized pet odor treatment or guaranteed odor removal, but we can thoroughly clean the affected areas and help reduce odors as part of the service.');
    }
    if (notes.length < 2) return notes;
    const groupedNote = (note) => {
      if (/carpet or rug shampoo/i.test(note)) return '• Professional carpet or rug shampoo/extraction cleaning is not included; carpeted areas and rugs can still be vacuumed as part of the service.';
      if (/carpet shampoo/i.test(note)) return '• Professional carpet shampoo/extraction cleaning is not included; carpeted areas can still be vacuumed as part of the service.';
      if (/rug shampoo/i.test(note)) return '• Professional rug shampoo/extraction cleaning is not included; rugs can still be vacuumed as part of the service.';
      if (/upholstery cleaning/i.test(note)) return '• Professional upholstery cleaning is not included.';
      if (/pet odor treatment/i.test(note)) return '• Specialized pet odor treatment and guaranteed odor removal are not included; affected areas can still be thoroughly cleaned to help reduce odors.';
      return note;
    };
    return [
      [
        '🧼 A quick note about the additional services requested:',
        '',
        ...notes.map(groupedNote)
      ].join('\n')
    ];
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
    const details = [
      'To help us find the best opening for you, please let us know:',
      '',
      '📅 Which day of the week works best',
      '⏰ Whether you prefer morning or afternoon',
      '📍 Your service address'
    ];
    if (review?.lead?.phoneNumber) details.push('📞 And please confirm if this is the best phone number to use for your appointment');
    details.push(
      '',
      'Once we have that information, we’ll check our schedule and send you the closest available options.'
    );
    return details;
  }
  function detailsRequestMessage(lead, company, requestedDetails) {
    const requested = new Set(requestedDetails || []);
    const items = [];
    if (requested.has('squareFeet')) items.push('• Approximate square footage');
    if (requested.has('bedrooms')) items.push('• Number of bedrooms');
    if (requested.has('bathrooms')) items.push('• Number of bathrooms');
    if (requested.has('photos')) items.push('• A few photos of the main areas (optional)');
    if (!items.length) return null;
    const companyName = {
      jheys: 'Jhey’s Cleaning',
      dasilva: 'Da Silva Cleaning Services',
      gleam: 'Gleam Team Housecleaning',
      express: 'Express House Cleaning'
    }[company] || 'KACS Cleaning Services LLC';
    return [
      greeting(lead?.customerName),
      '',
      `Thank you for reaching out to ${companyName}!`,
      '',
      'To prepare the most accurate estimate, could you please share the following:',
      '',
      ...items,
      '',
      'Once we have these details, we’ll be happy to provide your estimate and discuss the next steps.'
    ].join('\n');
  }
  const followUpDefinitions = {
    kacs: [
      {
        signatures: [
          "i tried giving you a quick call to follow up in case you're still looking for help with your home cleaning",
          "i just wanted to follow up in case you're still looking for help with your home cleaning"
        ],
        message: (name, lead) => lead?.phoneNumber ? [
          `Hi ${name}, this is Frank just checking in!`,
          '',
          "I tried giving you a quick call to follow up in case you're still looking for help with your home cleaning.",
          '',
          'At KACS Cleaning, we specialize in making your life easier — delivering a spotless home without you lifting a finger.',
          'Our cleanings are fully customized to your priorities, so you get exactly what you need, effortlessly.',
          '',
          'Looking forward to your reply!'
        ].join('\n') : [
          `Hi ${name}, this is Frank from KACS Cleaning.`,
          '',
          "I just wanted to follow up in case you're still looking for help with your home cleaning.",
          '',
          'At KACS Cleaning, we specialize in making your life easier — delivering a spotless home without you lifting a finger.',
          'Our cleanings are fully customized to your priorities, so you get exactly what you need, effortlessly.',
          '',
          'Let me know if you have any questions or special requests, we’d love to provide a personalized quote that fits exactly what you’re looking for.'
        ].join('\n')
      },
      {
        signature: "i noticed you saw our last message and wanted to follow up in case you're still looking for help with your home cleaning",
        message: (name) => [
          `Hi ${name}, this is Frank from KACS Cleaning again, just checking in!`,
          '',
          "I noticed you saw our last message and wanted to follow up in case you're still looking for help with your home cleaning.",
          '',
          'Let me know if you have any questions or special requests, we’d love to provide a personalized quote that fits exactly what you’re looking for.'
        ].join('\n')
      },
      {
        signature: "checking in to follow up on the cleaning service quote we've shared with you",
        message: (name) => [
          `Hi ${name}, this is Frank! I hope everything is okay!`,
          '',
          "I'm just checking in to follow up on the cleaning service quote we've shared with you.",
          '',
          'Let me know if you need more time, something not included in the checklist, or if you have any questions. Also, if you could let me know your budget, we can try to work within that.',
          '',
          'Feel free to contact me if you have any questions or would like to discuss adjustments.'
        ].join('\n')
      },
      {
        signature: "i wanted to check in to see if you're still interested in scheduling a home cleaning",
        message: (name) => [
          `Hi ${name}, this is Frank from KACS Cleaning Services -- just reaching out again!`,
          '',
          "I wanted to check in to see if you're still interested in scheduling a home cleaning. Our goal is to make things simple for you, with a sparkling clean home tailored exactly to your needs.",
          '',
          "Please feel free to share any details or questions -- we'd be glad to prepare a personalized quote that works perfectly for you."
        ].join('\n')
      }
    ],
    jheys: [
      {
        signature: 'whether you are still considering options for your home cleaning',
        message: (name) => [
          `Hi ${name}, this is Frank following up.`,
          '',
          'I wanted to check whether you are still considering options for your home cleaning.',
          '',
          'At Jhey’s Cleaning, our aim is to make the process simple and worry-free, with each service tailored to your home’s specific needs.',
          '',
          'Please let me know your thoughts whenever convenient.',
          '',
          'Best regards,',
          'Jhey’s Cleaning'
        ].join('\n')
      },
      {
        signature: 'follow up in case this message was previously overlooked',
        message: (name) => [
          `Hi ${name}, this is Frank from Jhey’s Cleaning once again.`,
          '',
          'I wanted to follow up in case this message was previously overlooked. There is no pressure at all — I simply wanted to remain available should you still be deciding.',
          '',
          'If any part of the estimate needs adjustment, I would be glad to review it with you.',
          '',
          'Best regards,',
          'Jhey’s Cleaning'
        ].join('\n')
      },
      {
        signature: 'follow up once more regarding the estimate we shared with you',
        message: (name) => [
          `Hi ${name}, this is Frank from Jhey’s Cleaning.`,
          '',
          'I wanted to follow up once more regarding the estimate we shared with you. I understand if timing may not be right just yet.',
          '',
          'If there is a specific budget you are working with, or an item in the checklist you would prefer to adjust, please let me know and we can review the options together.',
          '',
          'I remain available whenever you are ready to proceed or if you have any questions.',
          '',
          'Best regards,',
          'Jhey’s Cleaning'
        ].join('\n')
      },
      {
        signature: "i wanted to check in to see if you're still interested in scheduling a home cleaning",
        message: (name) => [
          `Hi ${name}, this is Frank from Jhey's Cleaning -- just reaching out again!`,
          '',
          "I wanted to check in to see if you're still interested in scheduling a home cleaning. Our goal is to make things simple for you, with a sparkling clean home tailored exactly to your needs.",
          '',
          "Please feel free to share any details or questions -- we'd be glad to prepare a personalized quote that works perfectly for you."
        ].join('\n')
      }
    ],
    dasilva: [
      { signature: 'chance to review the estimate we sent over', message: (name) => [`Hi ${name},`, '', 'I just wanted to follow up and make sure you had a chance to review the estimate we sent over.', '', "If you have any questions about the service or would like to go over the details, we'll be happy to help.", '', 'Da Silva Cleaning Services', '📞 (925) 515-3121'].join('\n') },
      { signature: 'information we requested for your cleaning estimate', message: (name) => [`Hi ${name},`, '', 'I just wanted to follow up regarding the information we requested for your cleaning estimate.', '', "Once we have those details, we'll be happy to review everything and prepare the best option for your home.", '', 'Whenever you have a chance, just send us the information here.', '', 'Da Silva Cleaning Services', '📞 (925) 515-3121'].join('\n') },
      { signature: 'we had previously been in touch', message: (name) => [`Hi ${name},`, '', 'I just wanted to check back in with you regarding your cleaning service.', '', 'We had previously been in touch, and I wanted to see if you had any questions about the estimate or if there’s anything else you’d like to discuss.', '', "We're happy to help whenever you're ready.", '', 'Da Silva Cleaning Services', '📞 (925) 515-3121'].join('\n') },
      { signature: 'sending us the information we needed for your home', message: (name) => [`Hi ${name},`, '', 'Thank you again for sending us the information we needed for your home.', '', 'I just wanted to follow up and make sure you had a chance to review the estimate we sent over.', '', "If you have any questions or would like to go over the details, we're happy to help.", '', 'Da Silva Cleaning Services', '📞 (925) 515-3121'].join('\n') }
    ],
    gleam: [
      { signature: 'chance to look over the quote', message: (name) => [`Hi ${name}! Just wanted to check back in and see if you had a chance to look over the quote.`, '', 'Has the timing changed on your end, or are you still thinking about getting the cleaning scheduled?', "Either way, no worries. If you have any questions, I'm here.", '', 'Gleam Team Housecleaning', '📞 (925) 515-5461'].join('\n') },
      { signature: 'information we were still missing for your cleaning quote', message: (name) => [`Hi ${name}! Just wanted to check back in about the information we were still missing for your cleaning quote.`, '', "If it's easier, you can just send us a few pictures or a short walkthrough video. We don't need anything fancy — it just helps us get a better idea of the home and price it properly.", '', "Whenever you get a chance, send it over and I'll take it from there.", '', 'Gleam Team Housecleaning', '📞 (925) 515-5461'].join('\n') },
      { signature: 'circle back on our conversation about the cleaning', message: (name) => [`Hi ${name}! Just wanted to circle back on our conversation about the cleaning.`, '', "I wanted to see if you were still thinking about moving forward or if something changed on your end.", '', 'No worries either way — just let me know when you get a chance.', '', 'Gleam Team Housecleaning', '📞 (925) 515-5461'].join('\n') },
      { signature: 'details you sent', message: (name) => [`Hi ${name}! Just wanted to check in now that you've had a chance to look over the quote we put together from the details you sent.`, '', "Does everything look good on your end, or is there anything you'd like us to change?", '', 'Gleam Team Housecleaning', '📞 (925) 515-5461'].join('\n') }
    ],
    express: [
      { signature: 'chance to review the estimate we sent over', message: (name) => [`Hi ${name}! This is Andie with Express House Cleaning.`, '', 'I just wanted to follow up and make sure you had a chance to review the estimate we sent over.', '', "If you have any questions about the cleaning or what's included, I'd be happy to help.", '', 'Express House Cleaning', '📞 (510) 757-9573'].join('\n') },
      { signature: 'we’re still missing', message: (name) => [`Hi ${name}! This is Andie with Express House Cleaning.`, '', 'I’m following up on your cleaning request. We’re still missing the remaining information before we can prepare your estimate.', '', "Whenever you have a chance, just send that information over and I’ll be happy to continue with the quote.", '', 'Express House Cleaning', '📞 (510) 757-9573'].join('\n') },
      { signature: 'regarding our conversation and the cleaning estimate', message: (name) => [`Hi ${name}! This is Andie with Express House Cleaning.`, '', 'I just wanted to check back in regarding our conversation and the cleaning estimate.', '', "I wasn’t sure if you were still considering the service, so I wanted to see if you had any questions or if there was anything else you needed from us.", '', 'Express House Cleaning', '📞 (510) 757-9573'].join('\n') },
      { signature: 'thank you again for sending over the information we needed', message: (name) => [`Hi ${name}! This is Andie with Express House Cleaning.`, '', 'Thank you again for sending over the information we needed.', '', 'I just wanted to check in and make sure you had a chance to review the estimate we sent afterward.', '', "If you have any questions about the quote or the service, I’d be happy to help.", '', 'Express House Cleaning', '📞 (510) 757-9573'].join('\n') }
    ]
  };
  function followUpStatus(company, lead, conversationText) {
    const followUps = followUpDefinitions[company] || [];
    const history = String(conversationText || '').toLocaleLowerCase();
    return followUps.map((followUp, index) => ({
      number: index + 1,
      sent: (followUp.signatures || [followUp.signature]).some((signature) => history.includes(signature)),
      message: followUp.message(lead?.customerName || 'there', lead)
    }));
  }
  function archivingMessage(company, lead) {
    const name = lead?.customerName || 'there';
    if (company === 'dasilva') return [
      `Hi ${name}, since we haven't heard back, we'll go ahead and close this request for now.`, '',
      "If you ever need professional cleaning in the future, simply reach out again—we'll be happy to prepare a new quote and assist you.", '',
      'We appreciate the opportunity and hope to work with you someday.', '',
      'Da Silva Cleaning Services', '📞 (925) 515-3121'
    ].join('\n');
    if (company === 'gleam') return [
      `Hi ${name}! We hadn't heard back, so we're going to leave this one here for now.`, '',
      'No worries at all if the timing wasn’t right. If you need a cleaning later, just send us a message and we’ll pick things back up.', '',
      'Take care!', 'Gleam Team Housecleaning', '📞 (925) 515-5461'
    ].join('\n');
    if (company === 'express') return [
      `Hi ${name}!`, '', 'Thank you once again for reaching out to Express House Cleaning!', '',
      'Since I haven’t heard back, I’ll go ahead and close your request for now. You’re always welcome to contact us again in the future.', '',
      'Wishing you all the best!', '', 'You can reach us by text or call at:', '', '📞 (510) 757-9573', 'Express House Cleaning'
    ].join('\n');
    if (company === 'jheys') return [
      `Hi ${name}, thank you again for reaching out to Jhey's Cleaning.`,
      '',
      'As we have not heard back, we will go ahead and close this request for now. You are always welcome to reach out again by submitting a new request or contacting us at 📞 (925) 515-5090.',
      '',
      'Wishing you all the best.',
      'Warm regards,',
      "Jhey's Cleaning"
    ].join('\n');
    return [
      `Hi ${name}! Thank you once again for reaching out to KACS Cleaning!`,
      '',
      'Since I haven’t heard back, I’ll go ahead and close your request for now, but no worries — you’re always welcome to contact us again by submitting a new request or by texting/calling us at (925) 438-0657.',
      '',
      'You can also explore our services here:',
      'Our Google page: https://g.co/kgs/df1X25U',
      '🌐 www.kacscleaning.com',
      '',
      'Wishing you all the best!',
      '— Frank | KACS Cleaning Services LLC'
    ].join('\n');
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
      '✨ We’re currently welcoming new clients and would love the opportunity to prepare a personalized cleaning plan for your home.',
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
      'Thank you for reaching out to Jhey’s Cleaning! ✨',
      '',
      'We’re currently welcoming new clients and would love the opportunity to make your home feel fresh, comfortable, and sparkling clean.',
      '',
      'Based on the details of your home, we recommend the following:'
    ];
    if (details.length) message.push('', ...details);
    message.push(
      '',
      `🧼 Recommended service: ${quote.serviceLabel || 'Cleaning'}`,
      `💲 Estimated investment: $${quote.priceRange?.minimum ?? quote.amount} to $${quote.priceRange?.maximum ?? Number(quote.amount || 0) + 100}`,
      '✨ Introductory pricing for new clients'
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
      'We would be delighted to welcome you to Jhey’s Cleaning. Please let us know if you would like to proceed or have any questions.',
      '',
      'Best regards,',
      'Jhey’s Cleaning',
      '📞 (925) 515-5090'
    );
    return message.join('\n');
  }

  const fixedPriceCompanies = {
    dasilva: { name: 'Da Silva Cleaning Services', phone: '(925) 515-3121' },
    gleam: { name: 'Gleam Team Housecleaning', shortName: 'Gleam Team', phone: '(925) 515-5461' },
    express: { name: 'Express House Cleaning', phone: '(510) 757-9573' }
  };
  function fixedPriceMissingSizeMessage(review) {
    const quote = review.quote || {}; const lead = review.lead || {}; const company = fixedPriceCompanies[quote.company];
    return [
      greeting(lead.customerName), '', `Thank you for reaching out to ${company.name}!`, '',
      `To prepare an accurate estimate for your ${quote.serviceLabel || lead.serviceType || 'cleaning service'}, could you please share the approximate square footage and the number of bedrooms and bathrooms?`, '',
      'A few photos or a short video of the main areas are also welcome.', '', company.name, `📞 ${company.phone}`
    ].join('\n');
  }
  function fixedPriceMessage(review) {
    const quote = review.quote || {}; const lead = review.lead || {}; const company = fixedPriceCompanies[quote.company];
    const price = `$${quote.priceRange?.minimum ?? quote.amount}–$${quote.priceRange?.maximum ?? Number(quote.amount || 0) + 100}`;
    const message = [greeting(lead.customerName), ''];
    if (quote.company === 'dasilva') {
      message.push(`Thank you for reaching out to ${company.name}! 😊`, '', "Based on your home's size, here's our estimate:", '', `🧼 Recommended Service: ${quote.serviceLabel}`, ...homeDetails(lead), `💰 Estimated Price: ${price}`, '', "The final price will depend on the home's current condition and the level of detail required.");
    } else if (quote.company === 'gleam') {
      message.push(`Thank you for reaching out to ${company.shortName}! 😊`, '', "Based on what you shared, here's our estimate for your home:", '', `🧽 ${quote.serviceLabel}`, `💲 Estimated price: ${price}`);
      if (quote.discount?.percentage) message.push(`✨ ${quote.discount.percentage}% discount applied to this initial cleaning`);
      message.push('👥 Team of 2 cleaners', '', '🌱 Green cleaning products', '🧒 Kid-safe', '🐶 Pet-safe', '🚫 Non-toxic products', '', 'Our standard cleaning includes dusting and wiping surfaces, including shelves, cleaning kitchen and bathroom surfaces, wiping down the exterior of appliances, vacuuming, mopping, and general tidying of the areas we clean.', '', "The initial cleaning price is an estimate and will depend on the home's size, condition, and cleaning needs.");
    } else {
      message.push('Thank you so much for contacting Express House Cleaning! We truly appreciate your interest in our services.', '', "Based on the information provided, here's our estimate for your home:", '', `🧼 ${quote.serviceLabel}`, '', `💲 Estimated price: ${price}`, '👥 Team: 2 professional cleaners', '', "The final price will depend on the home's overall condition and the level of detail required.");
    }
    if (quote.service === 'move_in_out') message.push('', 'To make the estimate more accurate and fair, please confirm whether the service is for a move-in or move-out.');
    const limitations = serviceLimitations(lead); if (limitations.length) message.push('', ...separatedParagraphs(limitations));
    const availability = selectedAvailability(review); if (availability.length) message.push('', ...availability);
    const noAvailability = noAvailabilityFollowUp(review); if (noAvailability.length) message.push('', ...noAvailability);
    message.push('', 'Please let us know if you have any questions or would like to schedule your cleaning. We’d be happy to help! 😊', '', company.name, `📞 ${company.phone}`);
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
    if (fixedPriceCompanies[quote.company] && quote.status === 'missing_size') return fixedPriceMissingSizeMessage(review);
    if (fixedPriceCompanies[quote.company] && quote.amount) return fixedPriceMessage(review);
    return 'This lead needs a manual review before a message can be prepared.';
  }

  global.CleaningQuoteMessages = { approvedMessage, archivingMessage, detailsRequestMessage, followUpStatus };
  if (typeof module !== 'undefined') module.exports = global.CleaningQuoteMessages;
})(globalThis);
