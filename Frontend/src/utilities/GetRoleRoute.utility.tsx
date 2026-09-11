import { PrivateRoutes, PublicRoutes, Roles } from '@/models';

export const getRoleRoute = (role: Roles): string => {
  
  switch (role) {
    case Roles.ADMIN:
      return `/${PrivateRoutes.ADMIN}`;
    case Roles.USER:
      return `/${PrivateRoutes.USER}`;
    case Roles.GUEST:
      return `/${PrivateRoutes.GUEST}`;
    default:
      return `/${PublicRoutes.LOGIN}`;
  }
};
