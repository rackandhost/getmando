import type { Component } from 'vue'

export interface IMenuItem {
  disabled?: boolean
  name: string
  pathName: string
  icon?: Component
}
