export * from './api/types';
export { api, fetchApi } from './api/core';
export { scheduleApi } from './api/schedule';
export { settingsApi } from './api/settings';
export { devicesApi } from './api/devices';
export { mediaApi } from './api/media';
export { palettesApi } from './api/palettes';
export { systemApi } from './api/system';
export { slideshowWorkflowApi } from './api/slideshowWorkflow';
export { slideshowsApi } from './api/slideshows';
export type { CreateSlideshowRequest, UpdateSlideshowRequest } from './api/slideshows';

import api from './api/core';

export default api;
