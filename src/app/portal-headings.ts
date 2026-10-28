export type PortalScreen =
  | 'forgot'
  | 'signin'
  | 'register'
  | 'home'
  | 'products'
  | 'couriers'
  | 'settings'
  | 'orders'
  | 'account';

/** The title and line under it for the signed-in header, which follow the screen the user is on. */
export function portalHeading(
  role: string,
  screen: PortalScreen,
): { title: string; subtitle: string } {
  if (screen === 'account')
    return { title: 'My account', subtitle: 'Your details and your password.' };
  if (role === 'admin') {
    switch (screen) {
      case 'orders':
        return {
          title: 'Orders',
          subtitle: 'Accept orders and follow them to collection or delivery.',
        };
      case 'products':
        return { title: 'Products', subtitle: 'Keep your menu and stock up to date.' };
      case 'couriers':
        return {
          title: 'Delivery team',
          subtitle: 'Add delivery people and manage who can deliver.',
        };
      case 'settings':
        return { title: 'Settings', subtitle: 'Opening hours, address and the store location.' };
      default:
        return {
          title: 'Store overview',
          subtitle: 'Manage orders, catalogue and settings in one place.',
        };
    }
  }
  if (role === 'courier')
    return { title: 'Delivery workspace', subtitle: 'Manage available and assigned deliveries.' };
  return {
    title: 'Your Royal account',
    subtitle: 'Everything you need to order, share and enjoy your treats.',
  };
}

/** The title and line above the sign-in, register and forgot-password forms. */
export function authCopy(screen: PortalScreen): { title: string; subtitle: string } {
  switch (screen) {
    case 'register':
      return { title: 'Join Royal Treats', subtitle: 'Create a customer profile' };
    case 'forgot':
      return {
        title: 'Forgot your password?',
        subtitle: 'Choose a new password and the shop will approve it',
      };
    default:
      return { title: 'Welcome back', subtitle: 'Sign in to your Royal Treats account' };
  }
}
