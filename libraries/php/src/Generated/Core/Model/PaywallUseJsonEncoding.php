<?php

namespace Voidhash\Generated\Core\Model;

class PaywallUseJsonEncoding
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
     * How the paywall is in use: `showing`, the location shows it; `rule`, one of the location's rules shows it; `pin`, people are pinned to it at the location; `experiment`, an arm of an A/B test that is not concluded or archived places it there, or would once the draft starts.
     *
     * @var string
     */
    protected $kind;
    /**
     * Whose requests the use answers: `production` (every key) or `test` (test keys only). An A/B test always places it in `production`.
     *
     * @var string
     */
    protected $environment;
    /**
     * The location's id, `pw_loc_...`.
     *
     * @var string
     */
    protected $paywallLocationId;
    /**
     * For `experiment`, the A/B test's id, `exp_...`; null otherwise.
     *
     * @var string|null
     */
    protected $experimentId;
    /**
     * The use as a person reads it, naming the location and any A/B test.
     *
     * @var string
     */
    protected $description;
    /**
     * How the paywall is in use: `showing`, the location shows it; `rule`, one of the location's rules shows it; `pin`, people are pinned to it at the location; `experiment`, an arm of an A/B test that is not concluded or archived places it there, or would once the draft starts.
     *
     * @return string
     */
    public function getKind(): string
    {
        return $this->kind;
    }
    /**
     * How the paywall is in use: `showing`, the location shows it; `rule`, one of the location's rules shows it; `pin`, people are pinned to it at the location; `experiment`, an arm of an A/B test that is not concluded or archived places it there, or would once the draft starts.
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
     * Whose requests the use answers: `production` (every key) or `test` (test keys only). An A/B test always places it in `production`.
     *
     * @return string
     */
    public function getEnvironment(): string
    {
        return $this->environment;
    }
    /**
     * Whose requests the use answers: `production` (every key) or `test` (test keys only). An A/B test always places it in `production`.
     *
     * @param string $environment
     *
     * @return self
     */
    public function setEnvironment(string $environment): self
    {
        $this->initialized['environment'] = true;
        $this->environment = $environment;
        return $this;
    }
    /**
     * The location's id, `pw_loc_...`.
     *
     * @return string
     */
    public function getPaywallLocationId(): string
    {
        return $this->paywallLocationId;
    }
    /**
     * The location's id, `pw_loc_...`.
     *
     * @param string $paywallLocationId
     *
     * @return self
     */
    public function setPaywallLocationId(string $paywallLocationId): self
    {
        $this->initialized['paywallLocationId'] = true;
        $this->paywallLocationId = $paywallLocationId;
        return $this;
    }
    /**
     * For `experiment`, the A/B test's id, `exp_...`; null otherwise.
     *
     * @return string|null
     */
    public function getExperimentId(): ?string
    {
        return $this->experimentId;
    }
    /**
     * For `experiment`, the A/B test's id, `exp_...`; null otherwise.
     *
     * @param string|null $experimentId
     *
     * @return self
     */
    public function setExperimentId(?string $experimentId): self
    {
        $this->initialized['experimentId'] = true;
        $this->experimentId = $experimentId;
        return $this;
    }
    /**
     * The use as a person reads it, naming the location and any A/B test.
     *
     * @return string
     */
    public function getDescription(): string
    {
        return $this->description;
    }
    /**
     * The use as a person reads it, naming the location and any A/B test.
     *
     * @param string $description
     *
     * @return self
     */
    public function setDescription(string $description): self
    {
        $this->initialized['description'] = true;
        $this->description = $description;
        return $this;
    }
}