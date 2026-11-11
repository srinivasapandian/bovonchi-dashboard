import { REVAMP_API } from '../api';

export const fetchCategoriesApi = (locationId: string) => {
  return REVAMP_API({
    method: 'post',
    url: '/api/v1/module',
    data: {
      entity: 'CATEGORY',
      filters: {
        location_id: locationId,
      },
    },
    headers: {
      'Content-Type': 'application/json',
    },
  });
};
