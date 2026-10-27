(function messageModule(global) {
  'use strict';

  function hours(value) { return Number.isInteger(value) ? String(value) : Number(value).toFixed(1); }
  function greeting(name) { return name ? `Hi ${name},` : 'Hi,'; }
  function countLabel(value, singular, plural) {
    return `${value || '?'} ${Number(value) === 1 ? singular : plural}`;
  }
  function homeDetails(lead) {
    const items = [];
    if (lead.bedrooms || lead.bathrooms) items.push(`🏠 Home: ${countLabel(lead.bedrooms, 'Bedroom', 'Bedrooms')} / ${countLabel(lead.bathrooms, 'Bathroom', 'Bathrooms')}`);
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
  function recurringCleaningSection(quote) {
    const recurring = quote?.recurringCleaning;
    if (!recurring) return [];
    const cadence = recurring.label || 'Recurring';
    const cadenceTitle = /^regular$/i.test(cadence) ? 'REGULAR CLEANING' : `${cadence.toUpperCase()} REGULAR CLEANING`;
    const section = [
      `🔄 AFTER THE FIRST CLEANING — ${cadenceTitle}`,
      '',
      `Once the First Cleaning has been completed, we can transition to a fixed recurring rate for ${cadence.toLowerCase()} service.`
    ];
    if (recurring.priceRange) {
      section.push('', `💲 ${cadence} Regular Cleaning: approximately $${recurring.priceRange.minimum} - $${recurring.priceRange.maximum} per visit`);
    }
    if (recurring.discount?.percentage) {
      section.push(`✨ ${recurring.discount.percentage}% regular-cleaning discount applied`);
    }
    if (recurring.firstRecurringDiscount?.priceRange) {
      const discount = recurring.firstRecurringDiscount;
      section.push('', `✨ ${discount.percentage}% new customer discount on your first ${cadence.toLowerCase()} regular cleaning: approximately $${discount.priceRange.minimum} - $${discount.priceRange.maximum} per visit. Future regular cleanings return to $${discount.standardPriceRange.minimum} - $${discount.standardPriceRange.maximum} per visit.`);
    }
    section.push('', 'The exact recurring rate will be confirmed after the First Cleaning.');
    return section;
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
    dasilva: [],
    gleam: [],
    express: []
  };
  function followUp(signature, message) { return { signature, message: (name) => message(name).join('\n') }; }
  function signed(lines, company, phone) { return [...lines, '', company, `📞 ${phone}`]; }
  const situationalFollowUps = {
    dasilva: [
      { title: 'Quote sent — no reply', signals: 'The quote is in the chat and the client has not replied.', messages: [
        followUp('chance to review the estimate we sent over', (name) => signed([`Hi ${name},`, '', 'I just wanted to follow up and make sure you had a chance to review the estimate we sent over.', '', "If you have any questions about the service or would like to go over the details, we'll be happy to help."], 'Da Silva Cleaning Services', '(925) 515-3121')),
        followUp("still considering cleaning services for your home", (name) => signed([`Hi ${name},`, '', "Just checking in to see if you're still considering cleaning services for your home.", '', "If you'd like to move forward or if there's anything you'd like us to adjust or clarify in the estimate, just let us know. We'd be happy to help."], 'Da Silva Cleaning Services', '(925) 515-3121')),
        followUp('one last time regarding the estimate we sent', (name) => signed([`Hi ${name},`, '', 'I just wanted to follow up one last time regarding the estimate we sent.', '', "If cleaning your home is still on your list, we'd be happy to assist whenever you're ready. And if you've already made other arrangements, no worries at all.", '', 'Thank you for considering Da Silva Cleaning Services!'], 'Da Silva Cleaning Services', '(925) 515-3121'))
      ] },
      { title: 'Details requested — no reply', signals: 'Information was requested and no quote appears in the chat.', messages: [
        followUp('information we requested for your cleaning estimate', (name) => signed([`Hi ${name},`, '', 'I just wanted to follow up regarding the information we requested for your cleaning estimate.', '', "Once we have those details, we'll be happy to review everything and prepare the best option for your home.", '', 'Whenever you have a chance, just send us the information here.'], 'Da Silva Cleaning Services', '(925) 515-3121')),
        followUp("we're still happy to prepare your estimate", (name) => signed([`Hi ${name},`, '', "Just checking in to see if you're still looking for cleaning services.", '', "We're still happy to prepare your estimate. We just need the remaining details about your home so we can make sure the quote is as accurate as possible.", '', 'Feel free to send them whenever it’s convenient for you.'], 'Da Silva Cleaning Services', '(925) 515-3121')),
        followUp("since we haven't received the remaining information", (name) => signed([`Hi ${name},`, '', 'I just wanted to follow up one last time regarding your cleaning request.', '', "Since we haven't received the remaining information, we won't be able to prepare the estimate just yet. If you'd still like a quote in the future, simply reach out and we'll be happy to help.", '', 'Thank you for considering Da Silva Cleaning Services!'], 'Da Silva Cleaning Services', '(925) 515-3121'))
      ] },
      { title: 'Quote sent, client replied, then stopped', signals: 'A quote is in the chat and the client replied after it.', messages: [
        followUp('we had previously been in touch', (name) => signed([`Hi ${name},`, '', 'I just wanted to check back in with you regarding your cleaning service.', '', 'We had previously been in touch, and I wanted to see if you had any questions about the estimate or if there’s anything else you’d like to discuss.', '', "We're happy to help whenever you're ready."], 'Da Silva Cleaning Services', '(925) 515-3121')),
        followUp('still considering the cleaning service we discussed', (name) => signed([`Hi ${name},`, '', 'Just touching base with you again to see if you’re still considering the cleaning service we discussed.', '', "If your plans have changed, that's completely understandable. And if you're still looking, we'd be happy to answer any questions or help with the next step."], 'Da Silva Cleaning Services', '(925) 515-3121')),
        followUp('one last time in case you are still looking for help with your home cleaning', (name) => signed([`Hi ${name},`, '', 'I just wanted to reach out one last time in case you’re still looking for help with your home cleaning.', '', 'If you’d like to continue with the service we discussed, simply send us a message and we’ll be happy to assist with scheduling.', '', 'Wishing you all the best, and thank you again for considering us!'], 'Da Silva Cleaning Services', '(925) 515-3121'))
      ] },
      { title: 'Details received, quote sent, then stopped', signals: 'The client sent requested details and a quote was then sent.', messages: [
        followUp('sending us the information we needed for your home', (name) => signed([`Hi ${name},`, '', 'Thank you again for sending us the information we needed for your home.', '', 'I just wanted to follow up and make sure you had a chance to review the estimate we sent over.', '', "If you have any questions or would like to go over the details, we're happy to help."], 'Da Silva Cleaning Services', '(925) 515-3121')),
        followUp('estimate we prepared for your home', (name) => signed([`Hi ${name},`, '', 'Just checking in regarding the estimate we prepared for your home.', '', "If you're still considering the service, we'd be happy to answer any questions or help you decide on the best option.", '', 'Whenever you’re ready, just send us a message.'], 'Da Silva Cleaning Services', '(925) 515-3121')),
        followUp('estimate we sent after receiving the information about your home', (name) => signed([`Hi ${name},`, '', 'I just wanted to follow up one last time regarding the estimate we sent after receiving the information about your home.', '', "If you're still looking for a cleaning service, we'd be happy to help whenever you're ready. And if you've already made other arrangements, we completely understand.", '', 'Thank you for giving us the opportunity to assist you!'], 'Da Silva Cleaning Services', '(925) 515-3121'))
      ] }
    ],
    gleam: [
      { title: 'Quote sent — no reply', signals: 'The quote is in the chat and the client has not replied.', messages: [
        followUp('chance to look over the quote', (name) => signed([`Hi ${name}! Just wanted to check back in and see if you had a chance to look over the quote.`, '', 'Has the timing changed on your end, or are you still thinking about getting the cleaning scheduled?', "Either way, no worries. If you have any questions, I'm here."], 'Gleam Team Housecleaning', '(925) 515-5461')),
        followUp("quote didn't get lost in the shuffle", (name) => signed([`Hi ${name}, just checking in again on the cleaning.`, '', "I know things get busy, so I wanted to make sure the quote didn't get lost in the shuffle. If there's anything you'd like to change or talk through, just send it my way."], 'Gleam Team Housecleaning', '(925) 515-5461')),
        followUp('one last check-in from us about the cleaning', (name) => signed([`Hi ${name}! Just one last check-in from us about the cleaning.`, '', "If you'd still like to schedule, just let me know and we'll pick things back up. And if the timing isn't right anymore, that's completely okay too.", '', "Whenever you're ready, we're here."], 'Gleam Team Housecleaning', '(925) 515-5461'))
      ] },
      { title: 'Details requested — no reply', signals: 'Information was requested and no quote appears in the chat.', messages: [
        followUp('information we were still missing for your cleaning quote', (name) => signed([`Hi ${name}! Just wanted to check back in about the information we were still missing for your cleaning quote.`, '', "If it's easier, you can just send us a few pictures or a short walkthrough video. We don't need anything fancy — it just helps us get a better idea of the home and price it properly.", '', "Whenever you get a chance, send it over and I'll take it from there."], 'Gleam Team Housecleaning', '(925) 515-5461')),
        followUp("we haven't been able to put the estimate together yet", (name) => signed([`Hi ${name}, just checking in on the quote.`, '', "We haven't been able to put the estimate together yet because we're still missing a few details about the home.", '', 'Whenever you have a moment, send over the information or a few pictures and we’ll take care of the rest.'], 'Gleam Team Housecleaning', '(925) 515-5461')),
        followUp("we haven't received the remaining details we need for the quote", (name) => signed([`Hi ${name}! Just one last check-in from Gleam Team Housecleaning.`, '', "We haven't received the remaining details we need for the quote, so we'll leave things here for now.", '', "If you'd still like an estimate later, just message us whenever you're ready and we'll pick it right back up."], 'Gleam Team Housecleaning', '(925) 515-5461'))
      ] },
      { title: 'Quote sent, client replied, then stopped', signals: 'A quote is in the chat and the client replied after it.', messages: [
        followUp('circle back on our conversation about the cleaning', (name) => signed([`Hi ${name}! Just wanted to circle back on our conversation about the cleaning.`, '', 'I wanted to see if you were still thinking about moving forward or if something changed on your end.', '', 'No worries either way — just let me know when you get a chance.'], 'Gleam Team Housecleaning', '(925) 515-5461')),
        followUp("not sure if you're still figuring out the timing", (name) => signed([`Hi ${name}, just checking back in with you.`, '', "I'm not sure if you're still figuring out the timing or if the cleaning ended up going in a different direction. If you want to revisit the quote or change anything about the service, I'm happy to take another look."], 'Gleam Team Housecleaning', '(925) 515-5461')),
        followUp('one last message from us for now', (name) => signed([`Hi ${name}! Just one last message from us for now.`, '', "If the cleaning isn't something you need right now, no worries at all. And if you'd like to pick things back up later, just send us a message and we'll be happy to continue where we left off.", '', 'Take care!'], 'Gleam Team Housecleaning', '(925) 515-5461'))
      ] },
      { title: 'Details received, quote sent, then stopped', signals: 'The client sent requested details and a quote was then sent.', messages: [
        followUp('quote we put together from the details you sent', (name) => signed([`Hi ${name}! Just wanted to check in now that you've had a chance to look over the quote we put together from the details you sent.`, '', "Does everything look good on your end, or is there anything you'd like us to change?"], 'Gleam Team Housecleaning', '(925) 515-5461')),
        followUp('estimate we sent over', (name) => signed([`Hi ${name}, just checking back in on the estimate we sent over.`, '', "If you're still thinking about it and have any questions, feel free to ask. And if you'd like us to adjust the scope a little, we can take another look at that too."], 'Gleam Team Housecleaning', '(925) 515-5461')),
        followUp('one last check-in from gleam team housecleaning about the quote', (name) => signed([`Hi ${name}! Just one last check-in from Gleam Team Housecleaning about the quote.`, '', "If you'd still like to get the cleaning scheduled, just let me know and we'll take it from there. If the timing changed, that's completely okay too.", '', "Whenever you need us, we're here."], 'Gleam Team Housecleaning', '(925) 515-5461'))
      ] }
    ],
    express: [
      { title: 'Quote sent — no reply', signals: 'The quote is in the chat and the client has not replied.', messages: [
        followUp('chance to review the estimate we sent over', (name) => signed([`Hi ${name}! This is Andie with Express House Cleaning.`, '', 'I just wanted to follow up and make sure you had a chance to review the estimate we sent over.', '', "If you have any questions about the cleaning or what's included, I'd be happy to help."], 'Express House Cleaning', '(510) 757-9573')),
        followUp('cleaning estimate we sent you', (name) => signed([`Hi ${name}! Just checking in regarding the cleaning estimate we sent you.`, '', 'If you’re still looking for a cleaning service, feel free to let me know if you’d like to go over any of the details or make any adjustments to the service.', '', 'I’ll be happy to help.'], 'Express House Cleaning', '(510) 757-9573')),
        followUp('one last time regarding your cleaning estimate', (name) => signed([`Hi ${name}! I wanted to follow up one last time regarding your cleaning estimate.`, '', "If you’re still interested, just let me know and we can continue from here. If your plans have changed, that's completely fine as well.", '', 'Thank you for considering Express House Cleaning!'], 'Express House Cleaning', '(510) 757-9573'))
      ] },
      { title: 'Details requested — no reply', signals: 'Information was requested and no quote appears in the chat.', messages: [
        followUp("we're still missing the information before we can prepare your estimate", (name) => signed([`Hi ${name}! This is Andie with Express House Cleaning.`, '', 'I’m following up on your cleaning request. We’re still missing the remaining information before we can prepare your estimate.', '', "Whenever you have a chance, just send that information over and I’ll be happy to continue with the quote."], 'Express House Cleaning', '(510) 757-9573')),
        followUp("we'd still be happy to prepare an estimate for you", (name) => signed([`Hi ${name}! Just checking in regarding your cleaning request.`, '', "We’d still be happy to prepare an estimate for you. We just need the remaining information to make sure we’re estimating the service correctly.", '', 'Feel free to send it whenever you have a chance.'], 'Express House Cleaning', '(510) 757-9573')),
        followUp("we haven't been able to prepare the estimate yet", (name) => signed([`Hi ${name}! I wanted to check in one last time regarding your cleaning request.`, '', "We haven’t been able to prepare the estimate yet because we’re still missing the remaining information.", '', 'If you’re still interested, just send that over and we can continue from there.', '', 'Thank you!'], 'Express House Cleaning', '(510) 757-9573'))
      ] },
      { title: 'Quote sent, client replied, then stopped', signals: 'A quote is in the chat and the client replied after it.', messages: [
        followUp('regarding our conversation and the cleaning estimate', (name) => signed([`Hi ${name}! This is Andie with Express House Cleaning.`, '', 'I just wanted to check back in regarding our conversation and the cleaning estimate.', '', 'I wasn’t sure if you were still considering the service, so I wanted to see if you had any questions or if there was anything else you needed from us.'], 'Express House Cleaning', '(510) 757-9573')),
        followUp('just checking in with you regarding the cleaning', (name) => signed([`Hi ${name}! Just checking in with you regarding the cleaning.`, '', "If you’re still interested, I’d be happy to go over the estimate again or make any adjustments based on what you’re looking for.", '', 'Just let me know what works for you.'], 'Express House Cleaning', '(510) 757-9573')),
        followUp('one last time regarding your cleaning request', (name) => signed([`Hi ${name}! I wanted to check in one last time regarding your cleaning request.`, '', 'I know plans can change, so I just wanted to see if you’re still looking for a cleaning service.', '', 'If you’d like to continue with the estimate, just send me a message and we can pick things back up from where we left off.', '', 'Thank you!'], 'Express House Cleaning', '(510) 757-9573'))
      ] },
      { title: 'Details received, quote sent, then stopped', signals: 'The client sent requested details and a quote was then sent.', messages: [
        followUp('thank you again for sending over the information we needed', (name) => signed([`Hi ${name}! This is Andie with Express House Cleaning.`, '', 'Thank you again for sending over the information we needed.', '', 'I just wanted to check in and make sure you had a chance to review the estimate we sent afterward.', '', 'If you have any questions about the quote or the service, I’d be happy to help.'], 'Express House Cleaning', '(510) 757-9573')),
        followUp('estimate we sent based on the details you provided', (name) => signed([`Hi ${name}! Just following up on the estimate we sent based on the details you provided.`, '', 'If you’re still considering the cleaning, feel free to let me know if there’s anything you’d like to clarify or adjust.', '', 'I’m happy to go over it with you.'], 'Express House Cleaning', '(510) 757-9573')),
        followUp('one last time regarding the estimate we sent you', (name) => signed([`Hi ${name}! I wanted to check in one last time regarding the estimate we sent you.`, '', 'If you’re still looking for cleaning services, just let me know and we can continue from here.', '', 'If your plans have changed, no problem at all.', '', 'Thank you again for considering Express House Cleaning!'], 'Express House Cleaning', '(510) 757-9573'))
      ] }
    ]
  };
  function daSilvaStyleFollowUps(companyName, phone) {
    return situationalFollowUps.dasilva.map((situation) => ({
      ...situation,
      messages: situation.messages.map((item) => ({
        ...item,
        message: (name, lead) => item.message(name, lead)
          .replaceAll('Da Silva Cleaning Services', companyName)
          .replaceAll('(925) 515-3121', phone)
      }))
    }));
  }
  situationalFollowUps.utcleans = daSilvaStyleFollowUps('UT Cleans', '(925) 202-0504');
  situationalFollowUps.marys = daSilvaStyleFollowUps("Mary's House Cleaning", '(925) 905-8387');
  function situationalFollowUpStatus(company, lead, conversationText) {
    const situations = situationalFollowUps[company];
    if (!situations) return null;
    const history = String(conversationText || '').toLocaleLowerCase();
    const hasQuote = /estimated (?:price|investment)|here.?s our estimate|recommended service|quote (?:we|that)|estimate (?:we|that)/i.test(history);
    const hasDetailsRequest = /approximate square footage|number of bedrooms|number of bathrooms|photos of the main areas|information we (?:requested|need)|details (?:about|for) (?:your )?home|walkthrough video/i.test(history);
    const suggestedSituation = hasQuote && hasDetailsRequest ? 4 : hasDetailsRequest ? 2 : hasQuote ? 1 : null;
    return {
      suggestedSituation,
      situations: situations.map((situation, index) => ({
        ...situation,
        number: index + 1,
        messages: situation.messages.map((item, stage) => ({
          ...item,
          stage: stage + 1,
          sent: history.includes(item.signature.toLocaleLowerCase()),
          message: item.message(lead?.customerName || 'there', lead)
        }))
      }))
    };
  }
  function followUpStatus(company, lead, conversationText) {
    const situational = situationalFollowUpStatus(company, lead, conversationText);
    if (situational) return situational;
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
    if (company === 'utcleans') return [
      `Hi ${name}, thank you for considering UT Cleans and for giving us the opportunity to assist you.`, '',
      "Since we haven't heard back from you, we'll close your request for now. If you'd like to schedule a cleaning with us in the future, we'd be more than happy to help. You can submit a new request or contact us directly at 📞 (925) 202-0504.", '',
      'We truly appreciate your interest and wish you all the best!', '', 'Warm regards,', 'UT Cleans', '📞 (925) 202-0504'
    ].join('\n');
    if (company === 'marys') return [
      `Hi ${name}! 😊`, '', "Thank you for considering Mary's House Cleaning.", '', "Since we haven't heard back, we'll go ahead and close your request for now.", '', "If you decide you'd like to schedule a cleaning with us in the future, you're always welcome to reach out again. We'd be happy to assist you whenever you're ready!", '', 'We appreciate your interest in our services and wish you all the best.', '', 'Warm regards,', "Mary's House Cleaning", '📞 (925) 905-8387'
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
    }
    if (details.length) message.push('', 'Based on the information you provided:', '', ...details);
    message.push('', `🧼 ${quote.serviceLabel.toUpperCase()}`, '', ...hourlyEstimate(quote));
    const recurring = recurringCleaningSection(quote);
    if (recurring.length) message.push('', ...recurring);
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
      `💲 Estimated investment: $${quote.priceRange?.minimum ?? quote.amount} to $${quote.priceRange?.maximum ?? Number(quote.amount || 0) + 100}`
    );
    if (quote.discount?.percentage) message.push(`✨ ${quote.discount.percentage}% new customer discount applied`);
    const recurring = recurringCleaningSection(quote);
    if (recurring.length) message.push('', ...recurring);
    const limitations = serviceLimitations(lead);
    if (limitations.length) message.push('', ...separatedParagraphs(limitations));
    const availability = selectedAvailability(review);
    if (availability.length) message.push('', ...availability);
    message.push(
      '',
      '👥 Team: 2 professional cleaners',
      '',
      'This first visit provides a thorough foundation, allowing future appointments to be more efficient, consistent, and budget-friendly.',
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
    utcleans: { name: 'UT Cleans', phone: '(925) 202-0504' },
    marys: { name: "Mary's House Cleaning", phone: '(925) 905-8387' },
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
    } else if (quote.company === 'utcleans') {
      message.push(`Thank you for providing your home details. For your home, here is what we suggest:`, '', `🧼 Initial Service: ${quote.serviceLabel}`, `💲 First Visit Estimate: ${price}`, '👥 Dedicated Team: 2 cleaners', '', 'Our first service focuses on creating a fresh baseline throughout your space, allowing future maintenance cleanings to be streamlined, consistent, and budget-friendly.');
    } else if (quote.company === 'marys') {
      const priceLabel = quote.discount?.percentage ? '💲 Special first-cleaning price' : '💲 Estimated price';
      message.push(`Thank you for providing the details about your home. We truly appreciate the information!`, '', `🧼 Recommended service: ${quote.serviceLabel}`, ...homeDetails(lead), `${priceLabel}: ${price}`, '', 'The final price may depend on the overall condition of the home and the level of cleaning required.', '', 'Our first visit is designed to establish a thorough cleaning foundation, making future maintenance cleanings more efficient and consistent.', '', 'Would you like us to check availability for your preferred date?');
    } else if (quote.company === 'gleam') {
      message.push(`Thank you for reaching out to ${company.shortName}! 😊`, '', "Based on what you shared, here's our estimate for your home:", '', `🧽 ${quote.serviceLabel}`, `💲 Estimated price: ${price}`);
      if (quote.discount?.percentage) message.push(`✨ ${quote.discount.percentage}% discount applied to this initial cleaning`);
      message.push('👥 Team of 2 cleaners', '', '🌱 Green cleaning products', '🧒 Kid-safe', '🐶 Pet-safe', '🚫 Non-toxic products', '', 'Our standard cleaning includes dusting and wiping surfaces, including shelves, cleaning kitchen and bathroom surfaces, wiping down the exterior of appliances, vacuuming, mopping, and general tidying of the areas we clean.', '', "The initial cleaning price is an estimate and will depend on the home's size, condition, and cleaning needs.");
    } else {
      message.push('Thank you so much for contacting Express House Cleaning! We truly appreciate your interest in our services.', '', "Based on the information provided, here's our estimate for your home:", '', `🧼 ${quote.serviceLabel}`, '', `💲 Estimated price: ${price}`, '👥 Team: 2 professional cleaners', '', "The final price will depend on the home's overall condition and the level of detail required.");
    }
    if (quote.discount?.percentage) message.push(`✨ ${quote.discount.percentage}% new customer discount applied`);
    const recurring = recurringCleaningSection(quote);
    if (recurring.length) message.push('', ...recurring);
    const limitations = serviceLimitations(lead); if (limitations.length) message.push('', ...separatedParagraphs(limitations));
    const availability = selectedAvailability(review); if (availability.length) message.push('', ...availability);
    const noAvailability = noAvailabilityFollowUp(review); if (noAvailability.length) message.push('', ...noAvailability);
    message.push('', 'Please let us know if you have any questions or would like to schedule your cleaning. We’d be happy to help! 😊', '');
    if (quote.company === 'marys') message.push('Warm regards,', company.name, `📞 ${company.phone}`);
    else if (quote.company === 'utcleans') message.push('Best regards,', company.name, `📞 ${company.phone}`);
    else message.push(company.name, `📞 ${company.phone}`);
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
