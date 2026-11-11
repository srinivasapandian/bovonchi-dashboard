import { REVAMP_API } from '../api';

export const fetchItemsApi = (locationId: string) => {
  return REVAMP_API({
    method: 'get',
    url: `/api/v1/items/${locationId}`,
  });
};
