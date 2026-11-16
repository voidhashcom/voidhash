<?php

namespace Voidhash\Generated\Core\Model;

class UpdateMetaMeasurementSettingsBodyJsonEncoding
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
     * The install referrer decryption key Meta shows for the app, 64 hexadecimal characters; `null` removes it. Write-only.
     *
     * @var string|null
     */
    protected $installReferrerKey;
    /**
     * Whether to send purchases to Meta's Conversions API. Turning it on needs a dataset and a token, and sends only purchases made from then on.
     *
     * @var bool|null
     */
    protected $isConversionsEnabled;
    /**
     * The dataset (pixel) id from Meta's Events Manager, digits only; `null` removes it, which is refused while conversions are on.
     *
     * @var string|null
     */
    protected $conversionsDatasetId;
    /**
     * An access token for the dataset, from Meta's Events Manager, at most 4096 characters; `null` removes it, which is refused while conversions are on. Write-only.
     *
     * @var string|null
     */
    protected $conversionsToken;
    /**
     * The code from Meta's Test Events tab, such as `TEST12345`: letters, digits, `_` and `-`, at most 64; `null` removes it and Meta counts the events again.
     *
     * @var string|null
     */
    protected $conversionsTestEventCode;
    /**
     * The install referrer decryption key Meta shows for the app, 64 hexadecimal characters; `null` removes it. Write-only.
     *
     * @return string|null
     */
    public function getInstallReferrerKey(): ?string
    {
        return $this->installReferrerKey;
    }
    /**
     * The install referrer decryption key Meta shows for the app, 64 hexadecimal characters; `null` removes it. Write-only.
     *
     * @param string|null $installReferrerKey
     *
     * @return self
     */
    public function setInstallReferrerKey(?string $installReferrerKey): self
    {
        $this->initialized['installReferrerKey'] = true;
        $this->installReferrerKey = $installReferrerKey;
        return $this;
    }
    /**
     * Whether to send purchases to Meta's Conversions API. Turning it on needs a dataset and a token, and sends only purchases made from then on.
     *
     * @return bool|null
     */
    public function getIsConversionsEnabled(): ?bool
    {
        return $this->isConversionsEnabled;
    }
    /**
     * Whether to send purchases to Meta's Conversions API. Turning it on needs a dataset and a token, and sends only purchases made from then on.
     *
     * @param bool|null $isConversionsEnabled
     *
     * @return self
     */
    public function setIsConversionsEnabled(?bool $isConversionsEnabled): self
    {
        $this->initialized['isConversionsEnabled'] = true;
        $this->isConversionsEnabled = $isConversionsEnabled;
        return $this;
    }
    /**
     * The dataset (pixel) id from Meta's Events Manager, digits only; `null` removes it, which is refused while conversions are on.
     *
     * @return string|null
     */
    public function getConversionsDatasetId(): ?string
    {
        return $this->conversionsDatasetId;
    }
    /**
     * The dataset (pixel) id from Meta's Events Manager, digits only; `null` removes it, which is refused while conversions are on.
     *
     * @param string|null $conversionsDatasetId
     *
     * @return self
     */
    public function setConversionsDatasetId(?string $conversionsDatasetId): self
    {
        $this->initialized['conversionsDatasetId'] = true;
        $this->conversionsDatasetId = $conversionsDatasetId;
        return $this;
    }
    /**
     * An access token for the dataset, from Meta's Events Manager, at most 4096 characters; `null` removes it, which is refused while conversions are on. Write-only.
     *
     * @return string|null
     */
    public function getConversionsToken(): ?string
    {
        return $this->conversionsToken;
    }
    /**
     * An access token for the dataset, from Meta's Events Manager, at most 4096 characters; `null` removes it, which is refused while conversions are on. Write-only.
     *
     * @param string|null $conversionsToken
     *
     * @return self
     */
    public function setConversionsToken(?string $conversionsToken): self
    {
        $this->initialized['conversionsToken'] = true;
        $this->conversionsToken = $conversionsToken;
        return $this;
    }
    /**
     * The code from Meta's Test Events tab, such as `TEST12345`: letters, digits, `_` and `-`, at most 64; `null` removes it and Meta counts the events again.
     *
     * @return string|null
     */
    public function getConversionsTestEventCode(): ?string
    {
        return $this->conversionsTestEventCode;
    }
    /**
     * The code from Meta's Test Events tab, such as `TEST12345`: letters, digits, `_` and `-`, at most 64; `null` removes it and Meta counts the events again.
     *
     * @param string|null $conversionsTestEventCode
     *
     * @return self
     */
    public function setConversionsTestEventCode(?string $conversionsTestEventCode): self
    {
        $this->initialized['conversionsTestEventCode'] = true;
        $this->conversionsTestEventCode = $conversionsTestEventCode;
        return $this;
    }
}