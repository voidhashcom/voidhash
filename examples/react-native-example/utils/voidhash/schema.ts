import { schemaConfiguration, unlockablePerk } from '@voidhash/react-native';

export const sc = schemaConfiguration({
  providers: {
    googlePlay: true,
    appleAppStore: true
  },
  perks: {
    allAccess: unlockablePerk('all-access', {
      name: 'All Access'
    })
  }
});

export const monthlySub = sc.subscription('monthly_sub', {
  name: 'Monthly',
  perks: {
    allAccess: true
  },
  providers: {
    googlePlay: {
      productId: 'com.voidhash.example.monthly'
    },
    appleAppStore: {
      productId: 'test_group_monthly'
    }
  }
});

export const yearlySub = sc.subscription('yearly_sub', {
  name: 'Yearly',
  perks: {
    allAccess: true
  },
  providers: {
    googlePlay: {
      productId: 'com.voidhash.example.yearly',
      basePlanId: 'com.voidhash.example.yearly.base'
    },
    appleAppStore: {
      productId: 'test_group_yearly'
    }
  }
});
