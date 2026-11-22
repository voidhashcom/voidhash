<?php

namespace Voidhash\Generated\Core\Model;

class PaywallBuildWithdrawalJsonEncoding
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
     * @var PaywallBuildJsonEncoding
     */
    protected $build;
    /**
     * Each place serving the build, in each environment, with what it serves instead while the build is withdrawn; empty when nothing serves it. Builds served only to apps that cannot show the deployed one are not listed.
     *
     * @var list<PaywallBuildWithdrawalPlacement>
     */
    protected $placements;
    /**
     * Whether A/B test arms are left out of `placements` because the credential cannot read experiments.
     *
     * @var bool
     */
    protected $isTestArmsHidden;
    /**
     * @return PaywallBuildJsonEncoding
     */
    public function getBuild(): PaywallBuildJsonEncoding
    {
        return $this->build;
    }
    /**
     * @param PaywallBuildJsonEncoding $build
     *
     * @return self
     */
    public function setBuild(PaywallBuildJsonEncoding $build): self
    {
        $this->initialized['build'] = true;
        $this->build = $build;
        return $this;
    }
    /**
     * Each place serving the build, in each environment, with what it serves instead while the build is withdrawn; empty when nothing serves it. Builds served only to apps that cannot show the deployed one are not listed.
     *
     * @return list<PaywallBuildWithdrawalPlacement>
     */
    public function getPlacements(): array
    {
        return $this->placements;
    }
    /**
     * Each place serving the build, in each environment, with what it serves instead while the build is withdrawn; empty when nothing serves it. Builds served only to apps that cannot show the deployed one are not listed.
     *
     * @param list<PaywallBuildWithdrawalPlacement> $placements
     *
     * @return self
     */
    public function setPlacements(array $placements): self
    {
        $this->initialized['placements'] = true;
        $this->placements = $placements;
        return $this;
    }
    /**
     * Whether A/B test arms are left out of `placements` because the credential cannot read experiments.
     *
     * @return bool
     */
    public function getIsTestArmsHidden(): bool
    {
        return $this->isTestArmsHidden;
    }
    /**
     * Whether A/B test arms are left out of `placements` because the credential cannot read experiments.
     *
     * @param bool $isTestArmsHidden
     *
     * @return self
     */
    public function setIsTestArmsHidden(bool $isTestArmsHidden): self
    {
        $this->initialized['isTestArmsHidden'] = true;
        $this->isTestArmsHidden = $isTestArmsHidden;
        return $this;
    }
}