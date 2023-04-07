import { $, Context, defineProperty, Dict, Random, Schema, User } from 'koishi'
import { Client, DataService } from '@koishijs/plugin-console'
import { resolve } from 'path'
import { SandboxBot } from './bot'
import zh from './locales/zh.yml'

declare module 'koishi' {
  namespace Session {
    interface Payload {
      client: Client
    }
  }
}

declare module '@koishijs/plugin-console' {
  namespace Console {
    interface Services {
      sandbox: SandboxService
    }
  }

  interface Events {
    'sandbox/message'(this: Client, platform: string, user: string, channel: string, content: string): void
    'sandbox/get-user'(this: Client, platform: string, pid: string): Promise<User>
    'sandbox/set-user'(this: Client, platform: string, pid: string, data: Partial<User>): Promise<void>
  }
}

export interface Message {
  id: string
  user: string
  channel: string
  content: string
}

export const filter = false
export const name = 'sandbox'
export const using = ['console']

export interface Config {}

export const Config: Schema<Config> = Schema.object({})

class SandboxService extends DataService<Dict<number>> {
  static using = ['database']

  constructor(ctx: Context) {
    super(ctx, 'sandbox')
  }

  async get() {
    const data = await this.ctx.database
      .select('binding')
      .groupBy('platform', {
        count: row => $.count(row.pid),
      })
      .execute()
    return Object.fromEntries(data.map(({ platform, count }) => [platform, count]))
  }
}

export function apply(ctx: Context, config: Config) {
  ctx.plugin(SandboxService)

  ctx.console.addEntry(process.env.KOISHI_BASE ? [
    process.env.KOISHI_BASE + '/dist/index.js',
    process.env.KOISHI_BASE + '/dist/style.css',
  ] : process.env.KOISHI_ENV === 'browser' ? [
    // @ts-ignore
    import.meta.url.replace(/\/src\/[^/]+$/, '/client/index.ts'),
  ] : {
    dev: resolve(__dirname, '../client/index.ts'),
    prod: resolve(__dirname, '../dist'),
  })

  const bots: Dict<SandboxBot> = {}

  ctx.console.addListener('sandbox/message', async function (platform, userId, channel, content) {
    const bot = bots[platform] ||= new SandboxBot(ctx, {
      platform,
      selfId: 'koishi',
    })
    bot.clients.add(this)
    const id = Random.id()
    ctx.console.broadcast('sandbox', { id, content, user: userId, channel })
    const session = bot.session({
      userId,
      content,
      messageId: id,
      channelId: channel,
      guildId: channel === '@' + userId ? undefined : channel,
      type: 'message',
      subtype: channel === '@' + userId ? 'private' : 'group',
      timestamp: Date.now(),
      author: {
        userId,
        username: userId,
      },
    })
    defineProperty(session, 'client', this)
    bot.dispatch(session)
  }, { authority: 4 })

  ctx.console.addListener('sandbox/get-user', async function (platform, pid) {
    if (!ctx.database) return
    return ctx.database.getUser(platform, pid)
  })

  ctx.console.addListener('sandbox/set-user', async function (platform, pid, data) {
    if (!ctx.database) return
    const [binding] = await ctx.database.get('binding', { platform, pid }, ['aid'])
    if (!binding) {
      if (!data) return
      await ctx.database.createUser(platform, pid, {
        authority: 1,
        ...data,
      })
    } else if (!data) {
      await ctx.database.remove('user', binding.aid)
      await ctx.database.remove('binding', { platform, pid })
    } else {
      await ctx.database.upsert('user', [{
        id: binding.aid,
        ...data,
      }])
    }
  }, { authority: 4 })

  ctx.on('console/connection', async (client) => {
    if (ctx.console.clients[client.id]) return
    for (const platform of Object.keys(bots)) {
      const bot = bots[platform]
      bot.clients.delete(client)
      if (!bot.clients.size) {
        delete bots[platform]
        delete ctx.bots[bot.sid]
      }
    }
  })

  ctx.i18n.define('zh', zh)

  ctx.platform('sandbox')
    .command('clear')
    .action(({ session }) => {
      session.client.send({
        type: 'sandbox/clear',
      })
    })
}
