import { Context } from '@koishijs/client'
import App from './index.vue'

export default function (ctx: Context) {
  ctx.slot({
    type: 'root',
    component: App,
    order: -1000,
  })
}
