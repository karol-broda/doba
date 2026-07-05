/* oxlint-disable no-console -- playground demo script */
/* oxlint-disable prefer-top-level-await -- wrapped in main() for error handling */
import { createRegistry } from 'dobajs'
import { z } from 'zod'

const legacySchema = z.object({
  legacyId: z.number(),
  fullName: z.string(),
  emailAddress: z.string().optional(),
  isAdmin: z.boolean(),
})

const accountSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.enum(['admin', 'member']),
})

const profileSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  email: z.string(),
  role: z.enum(['admin', 'member']),
  verified: z.boolean(),
})

const publicProfileSchema = z.object({
  id: z.string(),
  displayName: z.string(),
})

const analyticsUserSchema = z.object({
  userId: z.string(),
  segment: z.enum(['staff', 'customer']),
  contactable: z.boolean(),
})

const archiveSchema = z.object({
  key: z.string(),
  payload: z.string(),
})

const auditSchema = z.object({
  id: z.string(),
  actor: z.string(),
  action: z.string(),
})

const registry = createRegistry({
  schemas: {
    legacy: legacySchema,
    account: accountSchema,
    profile: profileSchema,
    publicProfile: publicProfileSchema,
    analyticsUser: analyticsUserSchema,
    archive: archiveSchema,
    audit: auditSchema,
  },

  migrations: {
    'legacy->account': {
      migrate: (user, context) => {
        const email =
          user.emailAddress ?? `${user.fullName.toLowerCase().replaceAll(/\s+/g, '.')}@example.com`

        if (user.emailAddress === undefined) {
          context.defaulted(['email'], 'generated from fullName')
        }

        return {
          id: `legacy-${user.legacyId}`,
          name: user.fullName,
          email,
          role: user.isAdmin ? 'admin' : 'member',
        }
      },
      preferred: true,
      label: 'normalize-legacy-user',
    },

    'account->profile': {
      migrate: (user, context) => {
        context.defaulted(['verified'], 'new profiles start unverified')

        return {
          id: user.id,
          displayName: user.name,
          email: user.email,
          role: user.role,
          verified: false,
        }
      },
      preferred: true,
      label: 'account-to-profile',
    },

    'legacy->profile': {
      migrate: (user, context) => {
        context.warn('legacy->profile skips account normalization')

        return {
          id: `legacy-${user.legacyId}`,
          displayName: user.fullName,
          email: user.emailAddress ?? 'unknown@example.com',
          role: user.isAdmin ? 'admin' : 'member',
          verified: false,
        }
      },
      deprecated: 'prefer legacy -> account -> profile',
      label: 'legacy-direct-profile',
    },

    'profile->publicProfile': {
      pipe: (builder) => builder.drop('email').drop('role').drop('verified'),
      label: 'strip-private-profile-fields',
    },

    'account->analyticsUser': {
      migrate: (user) => ({
        userId: user.id,
        segment: user.role === 'admin' ? 'staff' : 'customer',
        contactable: user.email.length > 0,
      }),
      cost: 2,
      label: 'account-to-analytics',
    },

    'profile->analyticsUser': {
      migrate: (user) => ({
        userId: user.id,
        segment: user.role === 'admin' ? 'staff' : 'customer',
        contactable: user.verified,
      }),
      cost: 5,
      label: 'profile-to-analytics',
    },

    'analyticsUser->archive': {
      migrate: (user) => ({
        key: user.userId,
        payload: JSON.stringify(user),
      }),
      label: 'archive-analytics-user',
    },

    'publicProfile->archive': {
      migrate: (profile) => ({
        key: profile.id,
        payload: JSON.stringify(profile),
      }),
      cost: 4,
      label: 'archive-public-profile',
    },

    'account<->audit': {
      forward: (user) => ({
        id: user.id,
        actor: user.name,
        action: `account:${user.role}`,
      }),
      backward: (audit) => ({
        id: audit.id,
        name: audit.actor,
        email: `${audit.actor.toLowerCase().replaceAll(/\s+/g, '.')}@example.com`,
        role: audit.action.includes('admin') ? 'admin' : 'member',
      }),
      cost: 3,
      label: 'account-audit-roundtrip',
    },
  },
})

async function main() {
  const legacyUser = {
    legacyId: 42,
    fullName: 'Alice Smith',
    isAdmin: true,
  }

  console.log(registry.visualize())
  console.log('\n--- mermaid ---')
  console.log(
    registry.visualize({
      format: 'mermaid',
      direction: 'TB',
      config: {
        theme: 'neutral',
        layout: 'elk',
      },
    }),
  )
  console.log('\n--- dot ---')
  console.log(registry.visualize({ format: 'dot', graphName: 'PlaygroundRegistry' }))
  console.log('\n--- json ---')
  console.log(registry.visualize({ format: 'json', space: 2 }))

  console.log('\n--- path choices ---')
  console.log('legacy -> profile', registry.findPath('legacy', 'profile'))
  console.log('legacy -> analyticsUser', registry.findPath('legacy', 'analyticsUser'))
  console.log('legacy -> archive', registry.findPath('legacy', 'archive'))
  console.log('audit -> publicProfile', registry.findPath('audit', 'publicProfile'))

  console.log('\n--- transform ---')
  const result = await registry.transform(legacyUser, 'legacy', 'archive', {
    validate: 'none',
  })

  console.log(result)
}

main().catch(console.error)
