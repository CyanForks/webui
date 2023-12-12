import { createRequire } from 'module'
import { UserConfig } from 'vite'
import { Context } from 'yakumo'
import { buildExtension } from '.'
import ns from 'ns-require'

declare module 'yakumo' {
  interface PackageConfig {
    client?: string
  }
}

export function apply(ctx: Context) {
  ctx.register('client', async () => {
    for (const path in ctx.yakumo.targets) {
      const meta = ctx.yakumo.targets[path]
      const deps = {
        ...meta.dependencies,
        ...meta.devDependencies,
        ...meta.peerDependencies,
        ...meta.optionalDependencies,
      }
      let config: UserConfig = {}
      if (meta.yakumo?.client) {
        const require = createRequire(ctx.yakumo.cwd + path + '/package.json')
        const exports = ns.unwrapExports(require(meta.yakumo.client))
        if (typeof exports === 'function') {
          await exports()
          continue
        }
        config = exports
      } else if (!deps['@koishijs/client']) {
        continue
      }
      await buildExtension(ctx.yakumo.cwd + path, config)
    }
  })
}
