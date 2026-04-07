/** Task presets shown in popup / options */
export const TASK_TYPES = [
  { id: 'studying', label: 'Studying' },
  { id: 'coding', label: 'Coding' },
  { id: 'job_hunt', label: 'Job hunting' },
  { id: 'writing', label: 'Writing' },
  { id: 'reading', label: 'Reading' },
  { id: 'other', label: 'Custom' }
];

export const SITE_PRESETS = {
  social: {
    label: 'Social',
    domains: ['twitter.com', 'x.com', 'instagram.com', 'facebook.com', 'tiktok.com', 'reddit.com']
  },
  video: {
    label: 'Video',
    domains: ['youtube.com', 'netflix.com', 'twitch.tv', 'disneyplus.com', 'hulu.com']
  },
  news: {
    label: 'News',
    domains: ['news.ycombinator.com', 'cnn.com', 'bbc.com', 'nytimes.com', 'theguardian.com']
  }
};

export const FRICTION_STYLES = [
  { id: 'balanced', label: 'Balanced', description: 'Pause → stronger confirm → hard limit' },
  { id: 'firm', label: 'Firm', description: 'One gentle step, then strict' }
];

export const GROUNDING_MESSAGES = [
  'A short pause is often enough to choose what you really want.',
  'Your attention is finite—spend it on what matters to you right now.',
  'You started this session for a reason. That reason still counts.',
  'One mindful choice now saves regret later.',
  'Breathe once. Then decide with intention—not habit.'
];

export function randomGroundingMessage() {
  const i = Math.floor(Math.random() * GROUNDING_MESSAGES.length);
  return GROUNDING_MESSAGES[i];
}
