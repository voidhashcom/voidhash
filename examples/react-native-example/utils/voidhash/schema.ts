import {
  definePerks,
  paymentProviders,
  subscription,
  unlockablePerk
} from '@voidhash/react-native';

// schema.ts

export const providers = paymentProviders({
  googlePlay: true,
  appleAppStore: true
});

export const perks = definePerks({
  allAccess: unlockablePerk('all-access', {
    name: 'All Access'
  })
});

export const monthlySub = subscription('monthly_sub', (s) => ({
  name: 'Monthly',
  perks: s.configurePerks(perks, () => ({
    allAccess: true
  })),
  providers: s.configureProviders(providers, () => ({
    googlePlay: {
      productId: 'com.voidhash.example.monthly'
    },
    appleAppStore: {
      productId: 'test_group_monthly'
    }
  }))
}));

export const yearlySub = subscription('yearly_sub', (s) => ({
  name: 'Yearly',
  perks: s.configurePerks(perks, () => ({
    allAccess: true
  })),
  providers: s.configureProviders(providers, () => ({
    googlePlay: {
      productId: 'com.voidhash.example.yearly',
      basePlanId: 'com.voidhash.example.yearly.base'
    },
    appleAppStore: {
      productId: 'test_group_yearly'
    }
  }))
}));
