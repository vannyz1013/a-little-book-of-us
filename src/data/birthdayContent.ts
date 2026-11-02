/**
 * Everything personal in the book lives in this one file.
 *
 * HOW TO FILL IT IN
 * - Replace any text in [square brackets] with your own words. Text that still
 *   contains "[" shows a small "placeholder" tag on the page, so anything you
 *   missed is easy to spot. The tag disappears once you replace the text.
 * - To add a photograph: put the file in public/images/memories/ and set
 *   `photo: 'images/memories/your-file.jpg'`, plus a `photoAlt` description.
 *   Leave `photo` out and a painted placeholder is shown instead.
 * - Between 5 and 15 memories works well. Add or delete entries freely.
 * - `date` is optional: delete the line to hide it.
 */

export interface Memory {
  title: string;
  date?: string;
  description: string;
  story: string;
  photo?: string;
  photoAlt?: string;
}

export interface NoteGroup {
  title: string;
  notes: string[];
}

const memories: Memory[] = [
  {
    title: '[Memory title: the day we met]',
    date: '[Date]',
    description: '[One short line about this memory.]',
    story: '[The story behind this photo, in your own words.]',
  },
  {
    title: '[Memory title: a trip together]',
    date: '[Date]',
    description: '[One short line about this memory.]',
    story: '[The story behind this photo, in your own words.]',
  },
  {
    title: '[Memory title: laughing too hard]',
    date: '[Date]',
    description: '[One short line about this memory.]',
    story: '[The story behind this photo, in your own words.]',
  },
  {
    title: '[Memory title: a favourite meal]',
    date: '[Date]',
    description: '[One short line about this memory.]',
    story: '[The story behind this photo, in your own words.]',
  },
  {
    title: '[Memory title: when you were there for me]',
    date: '[Date]',
    description: '[One short line about this memory.]',
    story: '[The story behind this photo, in your own words.]',
  },
  {
    title: '[Memory title: a very silly photo]',
    date: '[Date]',
    description: '[One short line about this memory.]',
    story: '[The story behind this photo, in your own words.]',
  },
];

const noteGroups: NoteGroup[] = [
  {
    title: 'Things I appreciate about you',
    notes: ['[Something you appreciate about them.]', '[Another one.]', '[One more.]'],
  },
  {
    title: 'Things you always say',
    notes: ['[A phrase they always say.]', '[Another one.]'],
  },
  {
    title: 'Little habits I remember',
    notes: ['[A small habit of theirs.]', '[Another one.]', '[One more.]'],
  },
  {
    title: 'Small moments that made me smile',
    notes: ['[A small moment.]', '[Another one.]'],
  },
  {
    title: 'Things I wish for you',
    notes: ['[Something you wish for them.]', '[Another one.]', '[One more.]'],
  },
];

export const birthdayContent = {
  recipientName: '[Recipient name]',
  senderName: '[Your name]',
  memories,
  noteGroups,
  letter: {
    greeting: 'Dear [Recipient name],',
    paragraphs: [
      '[Write your birthday message here. Each item in this list becomes its own paragraph.]',
      '[Add as many paragraphs as you like. The letter grows to fit them.]',
    ],
    signOff: '[With love,]',
  },
  finalMessage: 'Happy Birthday!',
};

/** True while a piece of text is still waiting for the real words. */
export const isPlaceholder = (text: string): boolean => text.includes('[');
