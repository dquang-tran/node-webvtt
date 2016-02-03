'use strict';

function ParserError (message, error) {
  this.message = message;
  this.error = error;
}
ParserError.prototype = Object.create(Error.prototype);

const TIMESTAMP_REGEXP = /([0-9]{2})?:?([0-9]{2}):([0-9]{2}\.[0-9]{3})/;

function parse (input) {

  if (typeof input !== 'string') {
    throw new ParserError('Input must be a string');
  }

  input = input.replace(/\r\n/g, '\n');
  input = input.replace(/\r/g, '\n');

  const parts = input.split('\n\n');

  const header = parts.shift();

  if (!header.startsWith('WEBVTT')) {
    throw new ParserError('Must start with "WEBVTT"');
  }

  const headerParts = header.split('\n');

  // nothing of interests, return early
  if (parts.length === 0 && headerParts.length === 1) {
    return { valid: true };
  }

  if (headerParts.length > 1 && headerParts[1] !== '') {
    throw new ParserError('No blank line after signature');
  }

  const cues = parseCues(parts);

  return { valid: true, cues };
}

function parseCues (cues) {
  const parsed = cues.map(parseCue);

  let lastEnd = 0;
  parsed.forEach((cue) => {
    if (cue.start < lastEnd) {
      throw new ParserError('Start timestamp less than end of previous');
    }
    lastEnd = cue.end;
  });

  return parsed;
}

function parseCue (cue) {
  let identifier = '';
  let start = 0;
  let end = 0;
  let text = '';
  let styles = '';

  // split and remove empty lines
  const lines = cue.split('\n').filter(Boolean);

  if (lines.length === 1 && !lines[0].includes('-->')) {
    throw new ParserError('Cue identifier cannot be standalone');
  }

  if (lines.length > 1 &&
      !(lines[0].includes('-->') || lines[1].includes('-->'))) {
    throw new ParserError('Cue identifier needs to be followed by timestamp');
  }

  if (lines.length > 1 && lines[1].includes('-->')) {
    identifier = lines.shift();
  }

  if (lines[0].includes('-->')) {
    const times = lines[0].split(' --> ');

    if (times.length !== 2 ||
        !validTimestamp(times[0]) ||
        !validTimestamp(times[1])) {
      throw new ParserError('Invalid cue timestamp');
    }

    start = parseTimestamp(times[0]);
    end = parseTimestamp(times[1]);

    if (start > end) {
      throw new ParserError('Start timestamp greater than end');
    }

    // TODO better style validation
    styles = times[1].replace(TIMESTAMP_REGEXP, '').trim();

    lines.shift();
  }

  text = lines.join('\n');

  return { identifier, start, end, text, styles };
}

function validTimestamp (timestamp) {
  return TIMESTAMP_REGEXP.test(timestamp);
}

function parseTimestamp (timestamp) {
  const matches = timestamp.match(TIMESTAMP_REGEXP);

  let secs = parseFloat(matches[3]);
  secs += parseFloat(matches[2]) * 60; // mins
  secs += parseFloat(matches[1] || 0) * 60 * 60; // hours
  return secs;
}

module.exports = { ParserError, parse };