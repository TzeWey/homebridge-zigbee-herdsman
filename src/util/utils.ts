import humanizeDuration from 'humanize-duration';

// construct a local ISO8601 string (instead of UTC-based)
// Example:
//  - ISO8601 (UTC) = 2019-03-01T15:32:45.941+0000
//  - ISO8601 (local) = 2019-03-01T16:32:45.941+0100 (for timezone GMT+1)
function toLocalISOString(date: Date): string {
  const tzOffset = -date.getTimezoneOffset();
  const plusOrMinus = tzOffset >= 0 ? '+' : '-';
  const pad = (num: number): string => {
    const norm = Math.floor(Math.abs(num));
    return (norm < 10 ? '0' : '') + norm;
  };

  return (
    date.getFullYear() +
    '-' +
    pad(date.getMonth() + 1) +
    '-' +
    pad(date.getDate()) +
    'T' +
    pad(date.getHours()) +
    ':' +
    pad(date.getMinutes()) +
    ':' +
    pad(date.getSeconds()) +
    plusOrMinus +
    pad(tzOffset / 60) +
    ':' +
    pad(tzOffset % 60)
  );
}

export function formatDate(time: number, type: 'ISO_8601' | 'ISO_8601_local' | 'epoch' | 'relative'): string | number {
  if (type === 'ISO_8601') {
    return new Date(time).toISOString();
  } else if (type === 'ISO_8601_local') {
    return toLocalISOString(new Date(time));
  } else if (type === 'epoch') {
    return time;
  } else {
    // relative
    return humanizeDuration(Date.now() - time, { language: 'en', largest: 2, round: true }) + ' ago';
  }
}

export const getEndpointNames = () => [
  'left',
  'right',
  'center',
  'bottom_left',
  'bottom_right',
  'default',
  'top_left',
  'top_right',
  'white',
  'rgb',
  'cct',
  'system',
  'top',
  'bottom',
  'center_left',
  'center_right',
  'ep1',
  'ep2',
  'row_1',
  'row_2',
  'row_3',
  'row_4',
  'relay',
  'usb',
  'l1',
  'l2',
  'l3',
  'l4',
  'l5',
  'l6',
  'l7',
  'l8',
  'l9',
  'l10',
  'l11',
  'l12',
  'l13',
  'l14',
  'l15',
  'l16',
  'button_1',
  'button_2',
  'button_3',
  'button_4',
  'button_5',
  'button_6',
  'button_7',
  'button_8',
  'button_9',
  'button_10',
  'button_11',
  'button_12',
  'button_13',
  'button_14',
  'button_15',
  'button_16',
  'button_17',
  'button_18',
  'button_19',
  'button_20',
  'button_light',
  'button_fan_high',
  'button_fan_med',
  'button_fan_low',
  'heat',
  'cool',
  'water',
  'meter',
  'wifi',
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function objectHasProperty(object: any, property: string): boolean {
  return Object.prototype.hasOwnProperty.call(object, property);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function objectHasProperties(object: any, properties: string[]): boolean {
  for (const property of properties) {
    if (!objectHasProperty(object, property)) {
      return false;
    }
  }
  return true;
}

export const secondsToMilliseconds = (seconds: number) => seconds * 1000;
