(function extractorModule(global) {
  'use strict';

  const text = () => document.body?.innerText || '';
  const firstMatch = (patterns, source = text()) => {
    for (const pattern of patterns) {
      const match = source.match(pattern);
      if (match?.[1]) return match[1].trim();
    }
    return null;
  };

  function platform() {
    if (location.hostname.includes('thumbtack.com')) return 'thumbtack';
    if (location.hostname.includes('yelp.com')) return 'yelp';
    return 'unknown';
  }

  function jsonObjectAt(source, start) {
    const open = source.indexOf('{', start);
    if (open < 0) return null;
    let depth = 0;
    let quoted = false;
    let escaped = false;
    for (let index = open; index < source.length; index += 1) {
      const character = source[index];
      if (quoted) {
        if (escaped) escaped = false;
        else if (character === '\\') escaped = true;
        else if (character === '"') quoted = false;
        continue;
      }
      if (character === '"') quoted = true;
      else if (character === '{') depth += 1;
      else if (character === '}') {
        depth -= 1;
        if (depth === 0) return source.slice(open, index + 1);
      }
    }
    return null;
  }

  function yelpApolloStateFromScripts(scripts) {
    const marker = 'window.yelp.react_apollo_state =';
    const source = Array.from(scripts).map((script) => script.textContent || '').find((value) => value.includes(marker));
    if (!source) return null;
    const json = jsonObjectAt(source, source.indexOf(marker) + marker.length);
    try { return json ? JSON.parse(json) : null; } catch { return null; }
  }

  function numberFromDescription(description, kind) {
    const expression = kind === 'bedrooms'
      ? /(\d+(?:\.\d+)?)(?:\s+or\s+more)?\s*(?:bed(?:room)?s?\b|br\b)/i
      : /(\d+(?:\.\d+)?)(?:\s+or\s+more)?\s*(?:bath(?:room)?s?\b|ba\b)/i;
    return description.match(expression)?.[1] || null;
  }

  function squareFeetFromText(value) {
    return firstMatch([
      /(?:square\s*(?:feet|foot)|sq\.?\s*ft\.?)\s*[:\-]?\s*([\d,]+)/i,
      /([\d,]+)\s*(?:square\s*(?:feet|foot)|sq\.?\s*ft\.?)/i
    ], String(value || ''));
  }

  function surveyAnswer(project, questionPattern) {
    const answer = (project.surveyQuestionAnswers || []).find((item) => questionPattern.test(item.question || ''));
    return answer?.answers?.filter(Boolean).join(', ') || null;
  }
  function firstName(value) {
    return String(value || '').trim().split(/\s+/)[0] || null;
  }
  function leadLocation(value) {
    const source = String(value || '');
    return source.match(/\b([A-Za-z][A-Za-z .'-]+,\s*CA\s*\d{5})\b/)?.[1]
      || source.match(/\b(\d{5}(?:-\d{4})?)\b/)?.[1]
      || null;
  }
  function yelpBusinessNameFromText(value) {
    const source = String(value || '');
    if (/jhey['’]s\s+cleaning(?:\s+services)?/i.test(source)) return 'Jhey’s Cleaning Services';
    if (/\bkacs\s+cleaning(?:\s+services)?/i.test(source)) return 'KACS Cleaning Services';
    if (/da\s*silva\s+cleaning(?:\s+services)?/i.test(source)) return 'Da Silva Cleaning Services';
    if (/gleam\s+team\s+housecleaning/i.test(source)) return 'Gleam Team Housecleaning';
    if (/express\s+house\s+cleaning/i.test(source)) return 'Express House Cleaning';
    return null;
  }

  function extractYelpLeadFromState(state, pathname) {
    const leadId = pathname.match(/\/leads\/([^/?#]+)/)?.[1];
    if (!leadId) return null;
    const lead = Object.values(state).find((record) => record?.__typename === 'Lead' && record.encid === leadId);
    const project = lead?.project?.__ref ? state[lead.project.__ref] : null;
    if (!project) return null;
    const business = Object.values(state).find((record) => record?.__typename === 'Business' && record.name);
    const description = project.description || '';
    const bedroomAnswer = surveyAnswer(project, /how many bedrooms/i);
    const bathroomAnswer = surveyAnswer(project, /how many bathrooms/i);
    const products = surveyAnswer(project, /cleaning product types/i);
    const extraServices = surveyAnswer(project, /other services/i);
    const customer = project.user?.__ref ? state[project.user.__ref] : null;
    return {
      id: `yelp:${leadId}`,
      platform: 'yelp',
      url: global.location?.href || null,
      companyName: business?.name || null,
      customerName: firstName(customer?.displayName),
      phoneNumber: lead.phoneNumberConnectionInfo?.consumerPhoneNumber || null,
      squareFeet: squareFeetFromText(description),
      bedrooms: numberFromDescription(bedroomAnswer || description, 'bedrooms'),
      bathrooms: numberFromDescription(bathroomAnswer || description, 'bathrooms'),
      serviceType: project.jobSummaryTitle || null,
      frequency: project.frequency || surveyAnswer(project, /how often.*home cleaned/i) || null,
      cleaningProducts: products,
      extraServices,
      location: leadLocation(`${project.description || ''} ${(project.surveyQuestionAnswers || []).flatMap((item) => item.answers || []).join(' ')}`),
      extractedAt: new Date().toISOString(),
      captureSource: 'yelp_apollo'
    };
  }

  function extractYelpLead() {
    const state = yelpApolloStateFromScripts(document.scripts);
    const apolloLead = state ? extractYelpLeadFromState(state, location.pathname) : null;
    const visibleLead = extractVisibleYelpLead();
    if (!apolloLead) return visibleLead;
    if (!visibleLead) return apolloLead;
    const currentAnswers = {
      bedrooms: visibleLead.bedrooms || apolloLead.bedrooms,
      bathrooms: visibleLead.bathrooms || apolloLead.bathrooms,
      frequency: visibleLead.frequency || apolloLead.frequency,
      location: visibleLead.location || apolloLead.location
    };
    return {
      ...apolloLead,
      ...currentAnswers,
      captureSource: (visibleLead.bedrooms && visibleLead.bedrooms !== apolloLead.bedrooms) || (visibleLead.bathrooms && visibleLead.bathrooms !== apolloLead.bathrooms)
        ? 'yelp_apollo_with_current_dom_answers'
        : apolloLead.captureSource
    };
  }

  function answerAfterLabel(source, label) {
    const lines = source.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const index = lines.findIndex((line) => line.toLowerCase().includes(label.toLowerCase()));
    return index < 0 ? null : lines.slice(index + 1).find(Boolean) || null;
  }
  function answerAfterLastLabel(source, label) {
    const lines = source.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const matches = lines.map((line, index) => line.toLowerCase().includes(label.toLowerCase()) ? index : -1).filter((index) => index >= 0);
    const index = matches.at(-1);
    return index === undefined ? null : lines.slice(index + 1).find(Boolean) || null;
  }

  function extractVisibleYelpLead() {
    const content = document.querySelector('main')?.innerText || text();
    const headings = Array.from(document.querySelectorAll('h1, h2, h3')).map((element) => element.innerText.trim());
    const serviceFromQuestions = answerAfterLabel(content, 'What kind of cleaning service') || answerAfterLabel(content, 'What kind of work would you like');
    const serviceType = headings.find((heading) => /regular home cleaning|deep cleaning|move[ -]?in|move[ -]?out|post[ -]?construction/i.test(heading)) || serviceFromQuestions || null;
    const bedroomAnswer = answerAfterLastLabel(content, 'How many bedrooms are in your home?');
    const bathroomAnswer = answerAfterLastLabel(content, 'How many bathrooms are in your home?');
    const bedrooms = numberFromDescription(bedroomAnswer || content, 'bedrooms');
    const bathrooms = numberFromDescription(bathroomAnswer || content, 'bathrooms');
    const names = Array.from(document.querySelectorAll('[data-font-weight="bold"]')).map((element) => element.innerText.trim());
    const customerName = names.find((name) => /^[A-Z][A-Za-z'-]+\s+[A-Z]\.$/.test(name)) || null;
    const businessId = location.pathname.match(/^\/leads_center\/([^/]+)/)?.[1] || null;
    const knownBusinessNames = {
      BnI3aSQTdRlX1YGUuPfAiA: 'Jhey’s Cleaning Services',
      FAHbiW72jLTiNDvcOptrfg: 'KACS Cleaning Services'
    };
    const companyName = yelpBusinessNameFromText(content) || knownBusinessNames[businessId] || null;
    if (!serviceType && !bedrooms && !bathrooms) return null;
    return {
      id: `yelp:${location.pathname.match(/\/leads\/([^/?#]+)/)?.[1] || location.pathname}`,
      platform: 'yelp',
      url: location.href,
      companyName,
      customerName: firstName(customerName),
      phoneNumber: null,
       squareFeet: squareFeetFromText(content),
      bedrooms,
      bathrooms,
      serviceType,
      frequency: answerAfterLabel(content, 'How often do you want your home cleaned?'),
      cleaningProducts: answerAfterLabel(content, 'Do you require any of these cleaning product types?'),
      extraServices: answerAfterLabel(content, 'Do you need any of these other services?'),
      location: leadLocation(content),
      extractedAt: new Date().toISOString(),
      captureSource: 'yelp_dom'
    };
  }

  function extractLead() {
    const yelpLead = platform() === 'yelp' ? extractYelpLead() : null;
    if (yelpLead) return yelpLead;
    const bodyText = text();
    const companyName = firstMatch([/(?:company|business)\s*(?:name)?\s*[:\-]\s*([^\n]+)/i], bodyText);
    const squareFeet = squareFeetFromText(bodyText);
    const bedrooms = firstMatch([/(\d+(?:\.\d+)?)\s*(?:bed(?:room)?s?\b|br\b)/i], bodyText);
    const bathrooms = firstMatch([/(\d+(?:\.\d+)?)\s*(?:bath(?:room)?s?\b|ba\b)/i], bodyText);
    const serviceType = firstMatch([/(?:service|cleaning type|type of cleaning)\s*[:\-]\s*([^\n]+)/i], bodyText)
      || ['post construction', 'move-in', 'move-out', 'deep cleaning', 'first cleaning', 'bi-weekly', 'monthly']
        .find((service) => bodyText.toLowerCase().includes(service));
    return {
      id: `${platform()}:${location.pathname}:${location.search}`,
      platform: platform(),
      url: location.href,
      companyName,
      squareFeet,
      bedrooms,
      bathrooms,
      serviceType,
      extractedAt: new Date().toISOString(),
      captureSource: 'generic_text'
    };
  }

  global.CleaningLeadExtractor = { extractLead, yelpApolloStateFromScripts, extractYelpLeadFromState, firstName, yelpBusinessNameFromText, surveyAnswer, squareFeetFromText };
  if (typeof module !== 'undefined') module.exports = global.CleaningLeadExtractor;
})(globalThis);
