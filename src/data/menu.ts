import type { IMenuItem } from '@/types/menu'

import { IconHome, IconServer, IconSettings2 } from '@tabler/icons-vue'

export const MENU: IMenuItem[] = [
  {
    name: 'menu.dashboard',
    pathName: 'dashboard',
    icon: IconHome,
  },
  {
    name: 'menu.services',
    pathName: 'services',
    icon: IconServer,
  },
  {
    name: 'menu.settings',
    pathName: 'settings',
    icon: IconSettings2,
  },
]
