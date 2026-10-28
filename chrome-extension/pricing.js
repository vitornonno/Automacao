/* global chrome */
(function pricingModule(global) {
  'use strict';

  const SIZE_BANDS = [800, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400, 2600, 2800, 3000];
  const SERVICES = {
    deep_cleaning: 'Deep Cleaning',
    first_cleaning: 'First Cleaning',
    move_in: 'Move-in Cleaning',
    move_out: 'Move-out Cleaning',
    monthly: 'Monthly Cleaning',
    biweekly: 'Bi-weekly Cleaning',
    post_construction: 'Post-Construction Cleaning',
    move_in_out: 'Move-In / Move-Out Cleaning'
  };
  const DISCOUNT_TARGETS = {
    regular: 'Regular Cleaning',
    first_cleaning: 'First Cleaning',
    deep_cleaning: 'Deep Cleaning',
    move_in: 'Move-In Cleaning',
    move_out: 'Move-Out Cleaning',
    post_construction: 'Post-Construction Cleaning'
  };
  const COMPANIES = {
    kacs: { name: 'KACS Cleaning Services' },
    jheys: { name: 'Jhey’s Cleaning' },
    dasilva: { name: 'Da Silva Cleaning Services' },
    utcleans: { name: 'UT Cleans' },
    marys: { name: "Mary's House Cleaning" },
    gleam: { name: 'Gleam Team Housecleaning' },
    express: { name: 'Express House Cleaning' }
  };
  const JHEYS_STYLE_COMPANIES = new Set(['jheys', 'dasilva', 'utcleans', 'marys', 'gleam', 'express']);

  const KACS_HOURS = {
    800: [2, 2, 2.5, 3, 1.5, 1.5, 3],
    1000: [2.5, 2, 3, 3.5, 2, 1.5, 3.5],
    1200: [3, 2.5, 3.5, 4, 2, 1.5, 4],
    1400: [3.5, 3, 4, 4.5, 2.5, 2, 5],
    1600: [4.5, 3.5, 5, 5.5, 2.5, 2.5, 5.5],
    1800: [5, 4, 5.5, 6, 3, 2.5, 6.5],
    2000: [5.5, 4, 6, 7, 3.5, 3, 7],
    2200: [6, 4.5, 7, 7.5, 3.5, 3, 7.5],
    2400: [6.5, 5, 7.5, 8.5, 4, 3.5, 8.5],
    2600: [7.5, 5.5, 8, 9, 4.5, 4, 9],
    2800: [8, 6, 9, 10, 4.5, 4, 10],
    3000: [8.5, 6.5, 9.5, 10.5, 5, 4.5, 10.5]
  };

  const BEGINNER_PRICES = {
    800: [165, 150, 185, 205, 120, 110, 250],
    1000: [195, 165, 220, 245, 130, 115, 300],
    1200: [225, 190, 250, 280, 140, 130, 360],
    1400: [270, 215, 305, 340, 170, 145, 420],
    1600: [325, 250, 365, 410, 195, 170, 480],
    1800: [370, 280, 410, 460, 220, 190, 540],
    2000: [410, 310, 460, 520, 250, 215, 600],
    2200: [460, 345, 510, 570, 275, 235, 660],
    2400: [495, 375, 560, 625, 300, 260, 720],
    2600: [550, 410, 610, 680, 325, 280, 780],
    2800: [595, 440, 660, 735, 350, 300, 840],
    3000: [640, 475, 710, 790, 375, 320, 900]
  };

  const SERVICE_INDEX = Object.keys(SERVICES);
  const INITIAL_LEAD_SERVICE_IDS = ['deep_cleaning', 'first_cleaning', 'move_in', 'move_out', 'post_construction'];
  const BED_BATH_TO_BAND = {
    '1|1': 800, '2|1': 1000, '2|2': 1200, '3|2': 1600,
    // No exact 3-bedroom/3-bathroom row exists; use the conservative viable 1,600 sq. ft. band.
    '3|3': 1600,
    '2|2.5': 1800, '4|2.5': 2000, '4|3': 2400, '4|4': 3000, '5|3.5': 2600, '5|4': 3000
  };

  const BED_BATH_BANDS = Object.entries(BED_BATH_TO_BAND)
    .map(([dimensions, band]) => {
      const [bedrooms, bathrooms] = dimensions.split('|').map(Number);
      return { bedrooms, bathrooms, band };
    });

  function normalizeService(value) {
    if (!value) return null;
    const text = String(value).toLowerCase().replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();
      if (/move[ -]?in\s*(?:or|\/)\s*move[ -]?out/.test(text)) return 'move_in_out';
    const aliases = [
      ['post_construction', /post[ -]?construction|construction clean/],
      ['move_in', /move[ -]?in/],
      ['move_out', /move[ -]?out/],
      ['deep_cleaning', /deep clean/],
      ['first_cleaning', /first clean|initial clean/],
      ['biweekly', /bi[ -]?weekly|every two weeks/],
      ['monthly', /monthly|once a month/]
    ];
    const matched = aliases.find(([, pattern]) => pattern.test(text));
    return matched ? matched[0] : null;
  }

  function resolveService(value, frequency) {
    const directMatch = normalizeService(value);
    if (directMatch) return directMatch;
    const serviceText = String(value || '').toLowerCase();
    if (!/regular|standard|home cleaning/.test(serviceText)) return null;
    // New leads always begin with a First Cleaning; recurring rates apply later.
    return 'first_cleaning';
  }

  function recurringCleaningFrequency(serviceType, frequency) {
    const serviceText = String(serviceType || '').toLowerCase();
    const frequencyText = String(frequency || '').toLowerCase();
    if (!/regular|standard|home cleaning/.test(serviceText) || /just once|one[- ]?time|single/.test(frequencyText)) return null;
    if (/bi[ -]?weekly|every\s*(?:2|two)\s*weeks?|fortnightly/.test(frequencyText)) {
      return { id: 'biweekly', label: 'Bi-weekly' };
    }
    if (/monthly|(?:once|every)\s+(?:a\s+)?month|every\s*(?:4|four)\s*weeks?/.test(frequencyText)) {
      return { id: 'monthly', label: 'Monthly' };
    }
    if (/weekly|(?:once|every)\s+(?:a\s+)?week/.test(frequencyText)) {
      return { id: 'weekly', label: 'Weekly' };
    }
    return { id: null, label: 'Recurring' };
  }

  function discountedRange(priceRange, percentage) {
    return {
      minimum: roundUpToNearestFive(priceRange.minimum * (1 - percentage / 100)),
      maximum: roundUpToNearestFive(priceRange.maximum * (1 - percentage / 100))
    };
  }

  function recurringCleaningQuote(frequency, band, regularDiscountPercent, firstRecurringDiscountPercent) {
    const minimum = BEGINNER_PRICES[band][SERVICE_INDEX.indexOf(frequency.id)];
    const standardPriceRange = { minimum, maximum: minimum + 30 };
    const priceRange = regularDiscountPercent > 0 ? discountedRange(standardPriceRange, regularDiscountPercent) : standardPriceRange;
    return {
      ...frequency,
      priceRange,
      discount: regularDiscountPercent > 0 ? { percentage: regularDiscountPercent, standardPriceRange } : null,
      firstRecurringDiscount: firstRecurringDiscountPercent > 0 ? {
        percentage: firstRecurringDiscountPercent,
        priceRange: discountedRange(standardPriceRange, firstRecurringDiscountPercent),
        standardPriceRange
      } : null
    };
  }

  function optionalDiscountPercent(value) {
    if (value === null || value === undefined || value === '') return null;
    const percentage = Number(value);
    return Number.isFinite(percentage) && percentage >= 0 && percentage <= 100 ? percentage : null;
  }

  function normalizedDiscountTarget(value) {
    return Object.hasOwn(DISCOUNT_TARGETS, value) ? value : null;
  }

  function normalizeNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(String(value).replace(/,/g, '').match(/\d+(?:\.\d+)?/)?.[0]);
    return Number.isFinite(number) ? number : null;
  }

  function roundToNearestHalfHour(value) {
    return Math.round(Number(value) * 2) / 2;
  }

  function roundUpToNearestFive(value) {
    return Math.ceil(Number(value) / 5) * 5;
  }

  function conservativeBedBathBand(bedrooms, bathrooms) {
    const candidates = BED_BATH_BANDS
      .filter((entry) => entry.bedrooms >= bedrooms && entry.bathrooms >= bathrooms)
      .sort((left, right) => left.band - right.band || left.bedrooms - right.bedrooms || left.bathrooms - right.bathrooms);
    return candidates[0]?.band ?? null;
  }

  function chooseSizeBand(lead) {
    const squareFeet = normalizeNumber(lead.squareFeet);
    if (squareFeet) {
      if (squareFeet > 3000) return { status: 'over_limit', squareFeet };
      return { status: 'resolved', band: SIZE_BANDS.find((band) => squareFeet <= band), source: 'square_feet', squareFeet };
    }
    const bedrooms = normalizeNumber(lead.bedrooms);
    const bathrooms = normalizeNumber(lead.bathrooms);
    if (bedrooms && bathrooms) {
      const band = BED_BATH_TO_BAND[`${bedrooms}|${bathrooms}`];
      if (band) return { status: 'resolved', band, source: 'bedrooms_bathrooms', bedrooms, bathrooms };
      const conservativeBand = conservativeBedBathBand(bedrooms, bathrooms);
      return {
        status: conservativeBand === null ? 'unmatched_size' : 'resolved',
        band: conservativeBand,
        source: 'bedrooms_bathrooms_conservative',
        bedrooms,
        bathrooms
      };
    }
    return { status: 'missing_size' };
  }

  function resolveCompany(companyName, override) {
    if (Object.hasOwn(COMPANIES, override)) return override;
    if (/\bkacs\b|kacs cleaning services/i.test(companyName || '')) return 'kacs';
    if (/jhey['’]?s cleaning/i.test(companyName || '')) return 'jheys';
    if (/da\s*silva\s+cleaning/i.test(companyName || '')) return 'dasilva';
    if (/\but\s*cleans?\b/i.test(companyName || '')) return 'utcleans';
    if (/mary['’]?s\s+house\s+cleaning/i.test(companyName || '')) return 'marys';
    if (/\bgleam\s+team(?:\s+housecleaning)?\b/i.test(companyName || '')) return 'gleam';
    if (/express\s+house\s+cleaning/i.test(companyName || '')) return 'express';
    return 'unknown';
  }

  function calculateQuote(lead, options = {}) {
    const company = resolveCompany(lead.companyName, options.companyOverride || lead.companyOverride);
    const requestedService = normalizeService(lead.serviceType);
    // Only Gleam needs the operational distinction between Move-In and Move-Out:
    // Yelp sends them as one request, so the attendant must select the correct one.
    const requiresMoveType = requestedService === 'move_in_out';
    const service = requiresMoveType ? null : resolveService(lead.serviceType, lead.frequency);
    const size = chooseSizeBand(lead);
    const recurringFrequency = recurringCleaningFrequency(lead.serviceType, lead.frequency);
    const configuredDiscount = optionalDiscountPercent(options.discountPercent);
    const discountTarget = normalizedDiscountTarget(options.discountTarget);
    // A percentage is an explicit request for a discount. If the VA has not
    // selected a target yet, apply it to the service currently being quoted.
    const effectiveDiscountTarget = discountTarget || (configuredDiscount > 0 ? service : null);
    const quotedRecurringFrequency = recurringFrequency && ['monthly', 'biweekly'].includes(recurringFrequency.id);
    // For a recurring Yelp request, "First Cleaning" means the introductory
    // discount belongs to the first regular visit after the initial cleaning.
    const firstRecurringDiscountPercent = service === 'first_cleaning' && recurringFrequency && effectiveDiscountTarget === 'first_cleaning'
      ? configuredDiscount
      : null;
    const base = {
      company,
      service,
      serviceLabel: service ? SERVICES[service] : null,
      size,
      status: 'needs_review',
      requiresHumanApproval: true,
      lead: { ...lead }
    };

    if (requiresMoveType) return { ...base, status: 'move_type_required', reason: 'Select Move-In or Move-Out Cleaning before preparing the quote.' };
    if (!service) return { ...base, status: 'missing_service', reason: 'No supported cleaning type was found.' };
    if (company === 'unknown') return { ...base, status: 'manual_company_required', reason: 'Select a supported company before calculating.' };
    if (size.status === 'missing_size') return { ...base, status: 'missing_size', reason: 'No usable square footage or bedroom/bathroom match was found.' };
    if (size.status === 'unmatched_size') return { ...base, status: company === 'kacs' ? 'manual_hours_required' : 'manual_quote_required', reason: 'The bedroom and bathroom count exceeds the supported combinations; obtain square footage or prepare a manual estimate.' };

    if (company === 'kacs') {
      if (size.status === 'over_limit') {
        return { ...base, status: 'manual_hours_required', hourlyRate: 100, reason: 'Homes above 3,000 sq. ft. require a human time estimate.' };
      }
        const rawBaseHours = KACS_HOURS[size.band][SERVICE_INDEX.indexOf(service)];
      const baseHours = roundToNearestHalfHour(rawBaseHours);
      const recurringCleaning = quotedRecurringFrequency
        ? recurringCleaningQuote(recurringFrequency, size.band, effectiveDiscountTarget === 'regular' ? configuredDiscount : null, firstRecurringDiscountPercent)
        : recurringFrequency ? { ...recurringFrequency, firstRecurringDiscount: firstRecurringDiscountPercent > 0 ? { percentage: firstRecurringDiscountPercent } : null } : null;
      return {
        ...base,
        quoteType: 'time_only',
        hourlyRate: 100,
        baseHours,
        toleranceHours: 1.5,
        estimatedHours: { minimum: baseHours, maximum: baseHours + 1.5 },
        recurringCleaning,
        pricingDisclosure: 'hourly_recommended',
        status: 'ready_for_review'
      };
    }

    if (size.status === 'over_limit') return { ...base, status: 'manual_quote_required', reason: 'Homes above 3,000 sq. ft. require a human quote.' };
      const baseAmount = BEGINNER_PRICES[size.band][SERVICE_INDEX.indexOf(service)];
      const discountApplies = configuredDiscount !== null && configuredDiscount > 0 && effectiveDiscountTarget === service && !firstRecurringDiscountPercent;
      const standardPriceRange = { minimum: baseAmount, maximum: baseAmount + 100 };
      const priceRange = discountApplies ? discountedRange(standardPriceRange, configuredDiscount) : standardPriceRange;
      const amount = priceRange.minimum;
      const recurringCleaning = quotedRecurringFrequency
        ? recurringCleaningQuote(recurringFrequency, size.band, effectiveDiscountTarget === 'regular' ? configuredDiscount : null, firstRecurringDiscountPercent)
        : recurringFrequency ? { ...recurringFrequency, firstRecurringDiscount: firstRecurringDiscountPercent > 0 ? { percentage: firstRecurringDiscountPercent } : null } : null;
      return {
      ...base,
      quoteType: 'fixed_price',
        amount,
      discount: discountApplies ? { percentage: configuredDiscount, amount: baseAmount - amount } : null,
      priceRange,
      currency: 'USD',
      recurringCleaning,
      status: 'ready_for_review'
    };
  }

  global.CleaningQuoteEngine = { calculateQuote, chooseSizeBand, normalizeService, resolveService, recurringCleaningFrequency, optionalDiscountPercent, normalizedDiscountTarget, resolveCompany, roundToNearestHalfHour, roundUpToNearestFive, conservativeBedBathBand, SERVICES, DISCOUNT_TARGETS, COMPANIES, JHEYS_STYLE_COMPANIES, SIZE_BANDS, INITIAL_LEAD_SERVICE_IDS };
  if (typeof module !== 'undefined') module.exports = global.CleaningQuoteEngine;
})(typeof globalThis !== 'undefined' ? globalThis : window);
