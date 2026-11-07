import { estimateReadingMinutes } from '../../../../utils/reading-time';

function applyReadingMinutes(data?: Record<string, unknown> | null) {
  if (!data || data.content == null) return;
  data.readingMinutes = estimateReadingMinutes(String(data.content));
}

export default {
  beforeCreate(event: { params: { data?: Record<string, unknown> } }) {
    applyReadingMinutes(event.params.data);
  },
  beforeUpdate(event: { params: { data?: Record<string, unknown> } }) {
    applyReadingMinutes(event.params.data);
  },
};
