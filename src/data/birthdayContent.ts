/**
 * Everything personal in the book lives in this one file.
 *
 * - Our Memories shows the photographs below, in this order, with no captions.
 *   Each photograph lives in public/images/memories/ and needs a `photoAlt`
 *   description for screen readers.
 * - The letter's paragraphs appear, in order, in the full birthday letter. The
 *   first one is set as a handwritten opening line.
 */

export interface Memory {
  photo: string;
  photoAlt: string;
}

const memories: Memory[] = [
  {
    photo: 'images/memories/IMG_0214.jpeg',
    photoAlt: 'The two of us smiling together in a selfie, making peace signs.',
  },
  {
    photo: 'images/memories/478.jpeg',
    photoAlt: 'The two of us at an event, standing in front of a Centre for Foundation Studies, Kampar Campus banner.',
  },
  {
    photo: 'images/memories/476.jpeg',
    photoAlt: 'The two of us at an exhibition booth, making peace signs.',
  },
];

export const birthdayContent = {
  recipientName: 'Mun Yi',
  senderName: 'Zi Nor',
  memories,
  letter: {
    greeting: 'Dear Mun Yi,',
    paragraphs: [
      'Happy Birthday!',
      "I hope you achieve the good results you've been working hard for. May you always have the courage to face challenges, and remember not to be too hard on yourself. Don't let worries take away the happiness in your everyday life.",
      'I hope you have fewer worries, less stress, and more reasons to smile. May every day bring you little moments of joy, and may everything go well for you.',
    ],
    signOff: 'With love,',
  },
  finalMessage: 'Happy Birthday!',
  finalSubtitle: 'Wishing you happiness, good health and a wonderful year ahead.',
};

/** True while a piece of text is still waiting for the real words. */
export const isPlaceholder = (text: string): boolean => text.includes('[');
