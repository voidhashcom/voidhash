<?php

namespace Voidhash\Generated\Core\Model;

class EvaluateProjectFeatureFlagsBodyJsonEncoding
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
     * The end user's person id, `person_...`.
     *
     * @var string|null
     */
    protected $personId;
    /**
     * A distinct id your app knows the end user by; when it belongs to a person, their other identities match too.
     *
     * @var string|null
     */
    protected $distinctId;
    /**
     * The end user's email address, for overrides and rules that name it.
     *
     * @var string|null
     */
    protected $email;
    /**
     * The end user's external ids, for overrides and rules that name them.
     *
     * @var list<string>|null
     */
    protected $externalIds;
    /**
     * The environment: `production`, or `test`, which a test key reads. Test follows production until a flag is given a test configuration of its own.
     *
     * @var string
     */
    protected $environment;
    /**
     * The keys of the flags to evaluate; omitted, every flag in use is.
     *
     * @var list<string>|null
     */
    protected $keys;
    /**
     * @var FeatureFlagEvaluationContext
     */
    protected $context;
    /**
     * Whether to only look: `true` says what the end user would get without placing them in an arm of a running experiment that sets one of the flags. Omitted or `false`, the evaluation counts as the end user's own, as your server's does when it decides what to serve them.
     *
     * @var bool|null
     */
    protected $isPreview;
    /**
     * The end user's person id, `person_...`.
     *
     * @return string|null
     */
    public function getPersonId(): ?string
    {
        return $this->personId;
    }
    /**
     * The end user's person id, `person_...`.
     *
     * @param string|null $personId
     *
     * @return self
     */
    public function setPersonId(?string $personId): self
    {
        $this->initialized['personId'] = true;
        $this->personId = $personId;
        return $this;
    }
    /**
     * A distinct id your app knows the end user by; when it belongs to a person, their other identities match too.
     *
     * @return string|null
     */
    public function getDistinctId(): ?string
    {
        return $this->distinctId;
    }
    /**
     * A distinct id your app knows the end user by; when it belongs to a person, their other identities match too.
     *
     * @param string|null $distinctId
     *
     * @return self
     */
    public function setDistinctId(?string $distinctId): self
    {
        $this->initialized['distinctId'] = true;
        $this->distinctId = $distinctId;
        return $this;
    }
    /**
     * The end user's email address, for overrides and rules that name it.
     *
     * @return string|null
     */
    public function getEmail(): ?string
    {
        return $this->email;
    }
    /**
     * The end user's email address, for overrides and rules that name it.
     *
     * @param string|null $email
     *
     * @return self
     */
    public function setEmail(?string $email): self
    {
        $this->initialized['email'] = true;
        $this->email = $email;
        return $this;
    }
    /**
     * The end user's external ids, for overrides and rules that name them.
     *
     * @return list<string>|null
     */
    public function getExternalIds(): ?array
    {
        return $this->externalIds;
    }
    /**
     * The end user's external ids, for overrides and rules that name them.
     *
     * @param list<string>|null $externalIds
     *
     * @return self
     */
    public function setExternalIds(?array $externalIds): self
    {
        $this->initialized['externalIds'] = true;
        $this->externalIds = $externalIds;
        return $this;
    }
    /**
     * The environment: `production`, or `test`, which a test key reads. Test follows production until a flag is given a test configuration of its own.
     *
     * @return string
     */
    public function getEnvironment(): string
    {
        return $this->environment;
    }
    /**
     * The environment: `production`, or `test`, which a test key reads. Test follows production until a flag is given a test configuration of its own.
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
     * The keys of the flags to evaluate; omitted, every flag in use is.
     *
     * @return list<string>|null
     */
    public function getKeys(): ?array
    {
        return $this->keys;
    }
    /**
     * The keys of the flags to evaluate; omitted, every flag in use is.
     *
     * @param list<string>|null $keys
     *
     * @return self
     */
    public function setKeys(?array $keys): self
    {
        $this->initialized['keys'] = true;
        $this->keys = $keys;
        return $this;
    }
    /**
     * @return FeatureFlagEvaluationContext
     */
    public function getContext(): FeatureFlagEvaluationContext
    {
        return $this->context;
    }
    /**
     * @param FeatureFlagEvaluationContext $context
     *
     * @return self
     */
    public function setContext(FeatureFlagEvaluationContext $context): self
    {
        $this->initialized['context'] = true;
        $this->context = $context;
        return $this;
    }
    /**
     * Whether to only look: `true` says what the end user would get without placing them in an arm of a running experiment that sets one of the flags. Omitted or `false`, the evaluation counts as the end user's own, as your server's does when it decides what to serve them.
     *
     * @return bool|null
     */
    public function getIsPreview(): ?bool
    {
        return $this->isPreview;
    }
    /**
     * Whether to only look: `true` says what the end user would get without placing them in an arm of a running experiment that sets one of the flags. Omitted or `false`, the evaluation counts as the end user's own, as your server's does when it decides what to serve them.
     *
     * @param bool|null $isPreview
     *
     * @return self
     */
    public function setIsPreview(?bool $isPreview): self
    {
        $this->initialized['isPreview'] = true;
        $this->isPreview = $isPreview;
        return $this;
    }
}