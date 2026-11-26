<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsAlertMetric
{
    /**
     * @var array
     */
    protected $initialized = [];
    public function isInitialized($property): bool
    {
        return array_key_exists($property, $this->initialized);
    }
    /**
     * The metric, as the metric query names it: `mrr`, `revenue`, `refunds`, an MRR movement (`new_mrr`, `expansion_mrr`, `reactivation_mrr`, `contraction_mrr`, `churned_mrr`, `net_new_mrr`), `active_subscriptions`, `new_subscriptions`, `churned_subscriptions`, `paying_customers`, `active_trials`, `new_trials` or `trial_conversions`. A flow (revenue, refunds, the movements, new and churned subscribers, new and converted trials) is summed over the window; a balance (MRR, active subscriptions, active trials) is read at the window's end; paying customers are counted once over it.
     *
     * @var string
     */
    protected $kind;
    /**
     * What an amount counts of a charge: `gross`, everything the customer paid; `net_of_tax`, that without tax; `proceeds`, that without tax and the store's commission.
     *
     * @var string
     */
    protected $basis;
    /**
     * The metric, as the metric query names it: `mrr`, `revenue`, `refunds`, an MRR movement (`new_mrr`, `expansion_mrr`, `reactivation_mrr`, `contraction_mrr`, `churned_mrr`, `net_new_mrr`), `active_subscriptions`, `new_subscriptions`, `churned_subscriptions`, `paying_customers`, `active_trials`, `new_trials` or `trial_conversions`. A flow (revenue, refunds, the movements, new and churned subscribers, new and converted trials) is summed over the window; a balance (MRR, active subscriptions, active trials) is read at the window's end; paying customers are counted once over it.
     *
     * @return string
     */
    public function getKind(): string
    {
        return $this->kind;
    }
    /**
     * The metric, as the metric query names it: `mrr`, `revenue`, `refunds`, an MRR movement (`new_mrr`, `expansion_mrr`, `reactivation_mrr`, `contraction_mrr`, `churned_mrr`, `net_new_mrr`), `active_subscriptions`, `new_subscriptions`, `churned_subscriptions`, `paying_customers`, `active_trials`, `new_trials` or `trial_conversions`. A flow (revenue, refunds, the movements, new and churned subscribers, new and converted trials) is summed over the window; a balance (MRR, active subscriptions, active trials) is read at the window's end; paying customers are counted once over it.
     *
     * @param string $kind
     *
     * @return self
     */
    public function setKind(string $kind): self
    {
        $this->initialized['kind'] = true;
        $this->kind = $kind;
        return $this;
    }
    /**
     * What an amount counts of a charge: `gross`, everything the customer paid; `net_of_tax`, that without tax; `proceeds`, that without tax and the store's commission.
     *
     * @return string
     */
    public function getBasis(): string
    {
        return $this->basis;
    }
    /**
     * What an amount counts of a charge: `gross`, everything the customer paid; `net_of_tax`, that without tax; `proceeds`, that without tax and the store's commission.
     *
     * @param string $basis
     *
     * @return self
     */
    public function setBasis(string $basis): self
    {
        $this->initialized['basis'] = true;
        $this->basis = $basis;
        return $this;
    }
}