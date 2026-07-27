import { PaywallBuild } from "../paywall-build/paywall-build";
import { LandingSection, ScaledMock, SectionHeader } from "../shared";

/** Renders the paywalls product section. */
export function LandingPaywalls() {
  return (
    <LandingSection id="paywalls">
      <div className="flex flex-col items-start justify-center gap-12 px-6 pt-16 pb-10 md:gap-23 md:px-12 md:pt-24 md:pb-14 xl:px-32 xl:pt-32 xl:pb-16">
        <SectionHeader
          description="Maximize your revenue by quickly testing your paywall designs and pricing with familiar no-code paywall builder."
          eyebrow="Paywalls"
          title="Ship paywalls in minutes with our no-code designer and full AI integration."
        />
        <ScaledMock designWidth={1368}>
          <div className="h-195.5 w-342 relative shrink-0">
          <div className="flex absolute w-342 left-0 top-0 flex-col items-start rounded-lg overflow-clip [background-color:var(--color-zinc-950)] border border-solid [border-color:var(--zinc-800)]">
            <div className="flex items-start gap-6.5 self-stretch p-3 border-b border-b-solid border-b-zinc-800/50">
              <div className="flex w-3.25 items-start gap-2.5 shrink-0">
                <div className="h-3.25 rounded-full self-stretch w-3.25 shrink-0 bg-zinc-700" />
                <div className="h-3.25 rounded-full self-stretch w-3.25 shrink-0 bg-zinc-700" />
                <div className="h-3.25 rounded-full self-stretch w-3.25 shrink-0 bg-zinc-700" />
              </div>
            </div>
            <div className="h-186 w-342 relative shrink-0 border border-solid border-zinc-800/50">
              <div className="w-342 h-186 top-[50%] left-[50%] absolute bg-zinc-900" style={{ translate: '-50% -50%' }} />
              <div className="items-center h-13.5 flex top-0 justify-between absolute px-3 bg-zinc-900 border-b border-b-solid border-b-zinc-800 -inset-x-px">
                <div className="items-center flex justify-center absolute gap-2 inset-0">
                  <div className="text-sm leading-[142.857%] font-sans text-zinc-50">
                    Example
                  </div>
                </div>
                <div className="items-center flex gap-2 relative">
                  <div className="items-center flex py-3 px-2 rounded-lg">
                    <svg aria-hidden="true" viewBox="0 0 120 61" xmlns="http://www.w3.org/2000/svg" fontSize="16px" width="120" height="61" style={{ height: '16px', width: '31.4688px', overflow: 'clip', flexShrink: '0' }}>
                      <path d="M60 30.5L90 0L120 0L120 30.5L90 30.5V61H60L60 30.5ZM0 30.5L30 30.5L30 0L60 0V30.5L30 61H0V30.5Z" fontSize="16px" fill="#FFFFFF" style={{ boxSizing: 'border-box', transformOrigin: '0px 0px' }} />
                    </svg>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" fontSize="16px" style={{ height: '16px', width: '16px', marginLeft: '8px', overflow: 'clip', flexShrink: '0' }}>
                      <path d="m6 9 6 6 6-6" fontSize="16px" fill="none" stroke="var(--zinc-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ boxSizing: 'border-box', transformOrigin: '0px 0px' }} />
                    </svg>
                  </div>
                  <div className="items-center flex w-fit rounded-lg relative [box-shadow:#0000000D_0px_1px_2px] bg-[#27272A4D] border border-solid border-zinc-800">
                    <div className="h-full w-[91.5px] top-0 left-0 absolute rounded-[9px] bg-zinc-800" />
                    <div className="items-center h-7 flex shrink-0 justify-center min-w-0 px-3 rounded-[9px] gap-1.5 relative">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" fontSize="14px" fontWeight="500" style={{ height: '16px', flexShrink: '0', width: '16px', overflow: 'clip' }}>
                        <path d="m14.622 17.897-10.68-2.913" fontSize="14px" fontWeight="500" fill="none" stroke="var(--zinc-50)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ boxSizing: 'border-box', transformOrigin: '0px 0px' }} />
                        <path d="M18.376 2.622a1 1 0 1 1 3.002 3.002L17.36 9.643a.5.5 0 0 0 0 .707l.944.944a2.41 2.41 0 0 1 0 3.408l-.944.944a.5.5 0 0 1-.707 0L8.354 7.348a.5.5 0 0 1 0-.707l.944-.944a2.41 2.41 0 0 1 3.408 0l.944.944a.5.5 0 0 0 .707 0z" fontSize="14px" fontWeight="500" fill="none" stroke="var(--zinc-50)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ boxSizing: 'border-box', transformOrigin: '0px 0px' }} />
                        <path d="M9 8c-1.804 2.71-3.97 3.46-6.583 3.948a.507.507 0 0 0-.302.819l7.32 8.883a1 1 0 0 0 1.185.204C12.735 20.405 16 16.792 16 15" fontSize="14px" fontWeight="500" fill="none" stroke="var(--zinc-50)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ boxSizing: 'border-box', transformOrigin: '0px 0px' }} />
                      </svg>
                      <div className="inline-block text-sm leading-[142.857%] text-center w-max shrink-0 font-sans font-medium text-zinc-50">
                        Design
                      </div>
                    </div>
                    <div className="items-center h-7 flex shrink-0 justify-center min-w-0 px-3 rounded-[9px] gap-1.5 relative">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" fontSize="14px" fontWeight="500" style={{ height: '16px', flexShrink: '0', width: '16px', overflow: 'clip' }}>
                        <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" fontSize="14px" fontWeight="500" fill="none" stroke="var(--zinc-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ boxSizing: 'border-box', transformOrigin: '0px 0px' }} />
                        <circle cx="12" cy="12" r="3" fontSize="14px" fontWeight="500" fill="none" stroke="var(--zinc-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ boxSizing: 'border-box', transformOrigin: '0px 0px' }} />
                      </svg>
                      <div className="inline-block text-sm leading-[142.857%] text-center w-max shrink-0 font-sans font-medium text-zinc-400">
                        Preview
                      </div>
                    </div>
                    <div className="items-center h-7 flex shrink-0 justify-center min-w-0 px-3 rounded-[9px] gap-1.5 relative">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" fontSize="14px" fontWeight="500" style={{ height: '16px', flexShrink: '0', width: '16px', overflow: 'clip' }}>
                        <path d="m18 16 4-4-4-4" fontSize="14px" fontWeight="500" fill="none" stroke="var(--zinc-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ boxSizing: 'border-box', transformOrigin: '0px 0px' }} />
                        <path d="m6 8-4 4 4 4" fontSize="14px" fontWeight="500" fill="none" stroke="var(--zinc-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ boxSizing: 'border-box', transformOrigin: '0px 0px' }} />
                        <path d="m14.5 4-5 16" fontSize="14px" fontWeight="500" fill="none" stroke="var(--zinc-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ boxSizing: 'border-box', transformOrigin: '0px 0px' }} />
                      </svg>
                      <div className="inline-block text-sm leading-[142.857%] text-center w-max shrink-0 font-sans font-medium text-zinc-400">
                        Code
                      </div>
                    </div>
                    <div className="items-center h-7 flex shrink-0 justify-center min-w-0 px-3 rounded-[9px] gap-1.5 relative">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" fontSize="14px" fontWeight="500" style={{ height: '16px', flexShrink: '0', width: '16px', overflow: 'clip' }}>
                        <path d="m5 8 6 6" fontSize="14px" fontWeight="500" fill="none" stroke="var(--zinc-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ boxSizing: 'border-box', transformOrigin: '0px 0px' }} />
                        <path d="m4 14 6-6 2-3" fontSize="14px" fontWeight="500" fill="none" stroke="var(--zinc-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ boxSizing: 'border-box', transformOrigin: '0px 0px' }} />
                        <path d="M2 5h12" fontSize="14px" fontWeight="500" fill="none" stroke="var(--zinc-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ boxSizing: 'border-box', transformOrigin: '0px 0px' }} />
                        <path d="M7 2h1" fontSize="14px" fontWeight="500" fill="none" stroke="var(--zinc-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ boxSizing: 'border-box', transformOrigin: '0px 0px' }} />
                        <path d="m22 22-5-10-5 10" fontSize="14px" fontWeight="500" fill="none" stroke="var(--zinc-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ boxSizing: 'border-box', transformOrigin: '0px 0px' }} />
                        <path d="M14 18h6" fontSize="14px" fontWeight="500" fill="none" stroke="var(--zinc-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ boxSizing: 'border-box', transformOrigin: '0px 0px' }} />
                      </svg>
                      <div className="inline-block text-sm leading-[142.857%] text-center w-max shrink-0 font-sans font-medium text-zinc-400">
                        Translate
                      </div>
                    </div>
                  </div>
                </div>
                <div className="items-center flex gap-2 relative">
                  <div className="items-center h-7 flex shrink-0 justify-center px-2.5 rounded-md gap-1 border border-solid border-[#00000000]">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" fontSize="12.8px" fontWeight="500" style={{ height: '16px', flexShrink: '0', width: '16px', marginRight: '4px', opacity: '0.7', overflow: 'clip' }}>
                      <path d="m16 18 6-6-6-6" fontSize="12.8px" fontWeight="500" fill="none" stroke="var(--zinc-50)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ boxSizing: 'border-box', transformOrigin: '0px 0px' }} />
                      <path d="m8 6-6 6 6 6" fontSize="12.8px" fontWeight="500" fill="none" stroke="var(--zinc-50)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ boxSizing: 'border-box', transformOrigin: '0px 0px' }} />
                    </svg>
                    <div className="inline-block text-[12.8px] leading-[150%] text-center w-max shrink-0 font-sans font-medium text-zinc-50">
                      Dev
                    </div>
                  </div>
                  <div className="items-center h-7 flex shrink-0 justify-center px-2.5 rounded-md gap-1 bg-zinc-800 border border-solid border-[#00000000]">
                    <div className="flex text-[12.8px] leading-[150%] text-center w-max shrink-0 font-sans font-medium text-zinc-50">
                      Share
                    </div>
                  </div>
                  <div className="items-center h-7 flex shrink-0 justify-center px-2.5 rounded-md gap-1 bg-blue-ribbon-600 border border-solid border-[#00000000]">
                    <div className="flex text-[12.8px] leading-[150%] text-center w-max shrink-0 font-sans font-medium text-white">
                      Publish
                    </div>
                  </div>
                </div>
              </div>
              <div className="-bottom-0.5 flex flex-col w-69 top-13.5 -right-px absolute bg-zinc-900 border-l border-l-solid border-l-zinc-800">
                <div className="flex basis-[0%] flex-col grow overflow-clip relative">
                  <div className="absolute inset-0">
                    <div className="h-full">
                      <div className="overflow-clip size-full">
                        <div className="table min-w-full">
                          <div className="">
                            <div className="border-b border-b-solid border-b-zinc-800">
                              <div className="items-center h-7 flex justify-between px-4 my-2">
                                <div className="text-sm leading-[142.857%] font-sans font-medium text-zinc-50">
                                  Variables
                                </div>
                                <div className="items-center flex justify-end gap-2">
                                  <div className="items-center flex shrink-0 justify-center rounded-md border border-solid border-[#00000000] size-7">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" fontSize="14px" fontWeight="500" style={{ height: '14px', flexShrink: '0', width: '14px', opacity: '0.7', overflow: 'clip' }}>
                                      <path d="m6 9 6 6 6-6" fontSize="14px" fontWeight="500" fill="none" stroke="var(--zinc-50)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ boxSizing: 'border-box', transformOrigin: '0px 0px' }} />
                                    </svg>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="border-b border-b-solid border-b-zinc-800">
                              <div className="items-center h-7 flex justify-between px-4 my-2">
                                <div className="text-sm leading-[142.857%] font-sans font-medium text-zinc-50">
                                  States
                                </div>
                                <div className="items-center flex justify-end gap-2">
                                  <div className="items-center flex shrink-0 justify-center rounded-md bg-zinc-800 border border-solid border-[#00000000] size-7">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" fontSize="14px" fontWeight="500" style={{ height: '14px', flexShrink: '0', width: '14px', opacity: '0.7', overflow: 'clip' }}>
                                      <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" fontSize="14px" fontWeight="500" fill="none" stroke="var(--zinc-50)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ boxSizing: 'border-box', transformOrigin: '0px 0px' }} />
                                      <circle cx="12" cy="12" r="3" fontSize="14px" fontWeight="500" fill="none" stroke="var(--zinc-50)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ boxSizing: 'border-box', transformOrigin: '0px 0px' }} />
                                    </svg>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="border-b border-b-solid border-b-zinc-800">
                              <div className="items-center h-7 flex justify-between px-4 my-2">
                                <div className="text-sm leading-[142.857%] font-sans font-medium text-zinc-50">
                                  Layout
                                </div>
                              </div>
                              <div className="pb-4 px-4">
                                <div className="mb-4">
                                  <div className="pt-2">
                                    <div className="flex gap-2">
                                      <div className="flex flex-col gap-2">
                                        <div className="">
                                          <div className="items-center flex w-fit rounded-lg relative [box-shadow:#0000000D_0px_1px_2px] bg-[#27272A4D] border border-solid border-zinc-800">
                                            <div className="h-full w-9.5 top-0 left-0 absolute rounded-[9px] bg-zinc-800" />
                                            <div className="items-center h-7 flex basis-[0%] grow justify-center min-w-0 px-3 rounded-[9px] gap-2 relative">
                                              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" fontSize="14px" fontWeight="500" style={{ height: '14px', flexShrink: '0', width: '14px', overflow: 'clip' }}>
                                                <path d="M12 5v14" fontSize="14px" fontWeight="500" fill="none" stroke="var(--zinc-50)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ boxSizing: 'border-box', transformOrigin: '0px 0px' }} />
                                                <path d="m19 12-7 7-7-7" fontSize="14px" fontWeight="500" fill="none" stroke="var(--zinc-50)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ boxSizing: 'border-box', transformOrigin: '0px 0px' }} />
                                              </svg>
                                            </div>
                                            <div className="items-center h-7 flex basis-[0%] grow justify-center min-w-0 px-3 rounded-[9px] gap-2 relative">
                                              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" fontSize="14px" fontWeight="500" style={{ height: '14px', flexShrink: '0', width: '14px', overflow: 'clip' }}>
                                                <path d="M5 12h14" fontSize="14px" fontWeight="500" fill="none" stroke="var(--zinc-50)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ boxSizing: 'border-box', transformOrigin: '0px 0px' }} />
                                                <path d="m12 5 7 7-7 7" fontSize="14px" fontWeight="500" fill="none" stroke="var(--zinc-50)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ boxSizing: 'border-box', transformOrigin: '0px 0px' }} />
                                              </svg>
                                            </div>
                                          </div>
                                        </div>
                                        <div className="">
                                          <div className="items-center h-7 flex w-full rounded-sm bg-[#27272A99]">
                                            <div className="h-7 flex basis-[0%] grow w-full min-w-0 items-center pr-1 pl-1.5 overflow-clip [box-shadow:#FAFAFA_0px_0px_0px]">
                                              <div className="h-fit w-full overflow-clip">
                                                <div className="text-sm leading-[142.857%] font-sans text-zinc-50 line-clamp-1">
                                                  0
                                                </div>
                                              </div>
                                            </div>
                                            <div className="items-center flex justify-center order-first pr-0.5 pl-2 gap-2 py-1">
                                              <div className="items-center flex justify-center shrink-0 size-3.5">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" fontSize="14px" fontWeight="500" style={{ height: '14px', width: '14px', overflow: 'clip', flexShrink: '0' }}>
                                                  <rect width="13" height="7" x="8" y="3" rx="1" fontSize="14px" fontWeight="500" fill="none" stroke="var(--zinc-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ height: '7px', boxSizing: 'border-box', width: '13px', transformOrigin: '0px 0px' }} />
                                                  <path d="m2 9 3 3-3 3" fontSize="14px" fontWeight="500" fill="none" stroke="var(--zinc-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ boxSizing: 'border-box', transformOrigin: '0px 0px' }} />
                                                  <rect width="13" height="7" x="8" y="14" rx="1" fontSize="14px" fontWeight="500" fill="none" stroke="var(--zinc-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ height: '7px', boxSizing: 'border-box', width: '13px', transformOrigin: '0px 0px' }} />
                                                </svg>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                      <div className="">
                                        <div className="flex rounded-sm bg-[#27272A99]">
                                          <div className="flex basis-[0%] flex-col grow">
                                            <div className="items-center flex basis-[0%] grow w-21 justify-center py-1 bg-[#27272ACC]">
                                              <div className="flex basis-[0%] flex-col grow justify-around">
                                                <div className="h-0.5 w-2 rounded-md shrink-0 bg-white" />
                                                <div className="h-0.5 w-2 rounded-md shrink-0 bg-white" />
                                                <div className="h-0.5 w-2 rounded-md shrink-0 bg-white" />
                                              </div>
                                            </div>
                                            <div className="items-center flex basis-[0%] grow w-21 justify-center py-1 relative">
                                              <div className="top-[50%] left-[50%] absolute" style={{ translate: '-50% -50%' }}>
                                                <div className="-bottom-0.5 top-0 -right-0.5 left-0 rounded-full absolute bg-zinc-400 size-0.5" style={{ translate: '-50% -50%' }} />
                                              </div>
                                            </div>
                                            <div className="items-center flex basis-[0%] grow w-21 justify-center py-1 relative">
                                              <div className="top-[50%] left-[50%] absolute" style={{ translate: '-50% -50%' }}>
                                                <div className="-bottom-0.5 top-0 -right-0.5 left-0 rounded-full absolute bg-zinc-400 size-0.5" style={{ translate: '-50% -50%' }} />
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                        <div className="items-center inline-flex justify-center rounded-md bg-zinc-800 border border-solid border-[#00000000] size-7">
                                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" fontSize="14px" fontWeight="500" style={{ height: '14px', flexShrink: '0', width: '14px', opacity: '0.7', overflow: 'clip' }}>
                                            <path d="M14 17H5" fontSize="14px" fontWeight="500" fill="none" stroke="var(--zinc-50)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ boxSizing: 'border-box', transformOrigin: '0px 0px' }} />
                                            <path d="M19 7h-9" fontSize="14px" fontWeight="500" fill="none" stroke="var(--zinc-50)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ boxSizing: 'border-box', transformOrigin: '0px 0px' }} />
                                            <circle cx="17" cy="17" r="3" fontSize="14px" fontWeight="500" fill="none" stroke="var(--zinc-50)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ boxSizing: 'border-box', transformOrigin: '0px 0px' }} />
                                            <circle cx="7" cy="7" r="3" fontSize="14px" fontWeight="500" fill="none" stroke="var(--zinc-50)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ boxSizing: 'border-box', transformOrigin: '0px 0px' }} />
                                          </svg>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                <div className="mb-4">
                                  <div className="text-xs leading-[133.333%] font-sans font-medium text-zinc-400">
                                    Dimensions
                                  </div>
                                  <div className="pt-2">
                                    <div className="flex gap-2">
                                      <div className="">
                                        <div className="items-center h-7 flex w-full opacity-[0.5] rounded-sm bg-[#27272ACC]">
                                          <div className="h-7 flex basis-[0%] grow w-full min-w-0 opacity-[0.5] items-center pr-1 pl-1.5 overflow-clip [box-shadow:#FAFAFA_0px_0px_0px]">
                                            <div className="h-fit w-full overflow-clip">
                                              <div className="text-sm leading-[142.857%] font-sans text-zinc-50 line-clamp-1">
                                                375
                                              </div>
                                            </div>
                                          </div>
                                          <div className="items-center flex justify-center order-first pr-0.5 pl-2 gap-2 py-1">
                                            <div className="items-center flex justify-center opacity-[0.5] shrink-0 size-3.5">
                                              <div className="text-xs leading-[133.333%] font-sans font-bold text-zinc-400">
                                                W
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                      <div className="">
                                        <div className="items-center h-7 flex w-full opacity-[0.5] rounded-sm bg-[#27272ACC]">
                                          <div className="h-7 flex basis-[0%] grow w-full min-w-0 opacity-[0.5] items-center pr-1 pl-1.5 overflow-clip [box-shadow:#FAFAFA_0px_0px_0px]">
                                            <div className="h-fit w-full overflow-clip">
                                              <div className="text-sm leading-[142.857%] font-sans text-zinc-50 line-clamp-1">
                                                812
                                              </div>
                                            </div>
                                          </div>
                                          <div className="items-center flex justify-center order-first pr-0.5 pl-2 gap-2 py-1">
                                            <div className="items-center flex justify-center opacity-[0.5] shrink-0 size-3.5">
                                              <div className="text-xs leading-[133.333%] font-sans font-bold text-zinc-400">
                                                H
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                <div className="">
                                  <div className="text-xs leading-[133.333%] font-sans font-medium text-zinc-400">
                                    Padding
                                  </div>
                                  <div className="pt-2">
                                    <div className="flex gap-2">
                                      <div className="flex flex-col gap-2">
                                        <div className="flex gap-2">
                                          <div className="">
                                            <div className="items-center h-7 flex w-full rounded-sm bg-[#27272A99]">
                                              <div className="h-7 flex basis-[0%] grow w-full min-w-0 items-center pr-1 pl-1.5 overflow-clip [box-shadow:#FAFAFA_0px_0px_0px]">
                                                <div className="h-fit w-full overflow-clip">
                                                  <div className="text-sm leading-[142.857%] font-sans text-zinc-50 line-clamp-1">
                                                    0
                                                  </div>
                                                </div>
                                              </div>
                                              <div className="items-center flex justify-center order-first pr-0.5 pl-2 gap-2 py-1">
                                                <div className="items-center flex justify-center shrink-0 size-3.5">
                                                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" fontSize="14px" fontWeight="500" style={{ height: '14px', width: '14px', overflow: 'clip', flexShrink: '0' }}>
                                                    <path d="M15 10V9" fontSize="14px" fontWeight="500" fill="none" stroke="var(--zinc-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ boxSizing: 'border-box', transformOrigin: '0px 0px' }} />
                                                    <path d="M15 15v-1" fontSize="14px" fontWeight="500" fill="none" stroke="var(--zinc-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ boxSizing: 'border-box', transformOrigin: '0px 0px' }} />
                                                    <path d="M15 21v-2" fontSize="14px" fontWeight="500" fill="none" stroke="var(--zinc-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ boxSizing: 'border-box', transformOrigin: '0px 0px' }} />
                                                    <path d="M15 5V3" fontSize="14px" fontWeight="500" fill="none" stroke="var(--zinc-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ boxSizing: 'border-box', transformOrigin: '0px 0px' }} />
                                                    <path d="M9 10V9" fontSize="14px" fontWeight="500" fill="none" stroke="var(--zinc-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ boxSizing: 'border-box', transformOrigin: '0px 0px' }} />
                                                    <path d="M9 15v-1" fontSize="14px" fontWeight="500" fill="none" stroke="var(--zinc-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ boxSizing: 'border-box', transformOrigin: '0px 0px' }} />
                                                    <path d="M9 21v-2" fontSize="14px" fontWeight="500" fill="none" stroke="var(--zinc-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ boxSizing: 'border-box', transformOrigin: '0px 0px' }} />
                                                    <path d="M9 5V3" fontSize="14px" fontWeight="500" fill="none" stroke="var(--zinc-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ boxSizing: 'border-box', transformOrigin: '0px 0px' }} />
                                                    <rect x="3" y="3" width="18" height="18" rx="2" fontSize="14px" fontWeight="500" fill="none" stroke="var(--zinc-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ height: '18px', boxSizing: 'border-box', width: '18px', transformOrigin: '0px 0px' }} />
                                                  </svg>
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                          <div className="">
                                            <div className="items-center h-7 flex w-full rounded-sm bg-[#27272A99]">
                                              <div className="h-7 flex basis-[0%] grow w-full min-w-0 items-center pr-1 pl-1.5 overflow-clip [box-shadow:#FAFAFA_0px_0px_0px]">
                                                <div className="h-fit w-full overflow-clip">
                                                  <div className="text-sm leading-[142.857%] font-sans text-zinc-50 line-clamp-1">
                                                    0
                                                  </div>
                                                </div>
                                              </div>
                                              <div className="items-center flex justify-center order-first pr-0.5 pl-2 gap-2 py-1">
                                                <div className="items-center flex justify-center shrink-0 size-3.5">
                                                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" fontSize="14px" fontWeight="500" style={{ height: '14px', width: '14px', overflow: 'clip', flexShrink: '0' }}>
                                                    <path d="M14 15h1" fontSize="14px" fontWeight="500" fill="none" stroke="var(--zinc-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ boxSizing: 'border-box', transformOrigin: '0px 0px' }} />
                                                    <path d="M14 9h1" fontSize="14px" fontWeight="500" fill="none" stroke="var(--zinc-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ boxSizing: 'border-box', transformOrigin: '0px 0px' }} />
                                                    <path d="M19 15h2" fontSize="14px" fontWeight="500" fill="none" stroke="var(--zinc-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ boxSizing: 'border-box', transformOrigin: '0px 0px' }} />
                                                    <path d="M19 9h2" fontSize="14px" fontWeight="500" fill="none" stroke="var(--zinc-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ boxSizing: 'border-box', transformOrigin: '0px 0px' }} />
                                                    <path d="M3 15h2" fontSize="14px" fontWeight="500" fill="none" stroke="var(--zinc-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ boxSizing: 'border-box', transformOrigin: '0px 0px' }} />
                                                    <path d="M3 9h2" fontSize="14px" fontWeight="500" fill="none" stroke="var(--zinc-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ boxSizing: 'border-box', transformOrigin: '0px 0px' }} />
                                                    <path d="M9 15h1" fontSize="14px" fontWeight="500" fill="none" stroke="var(--zinc-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ boxSizing: 'border-box', transformOrigin: '0px 0px' }} />
                                                    <path d="M9 9h1" fontSize="14px" fontWeight="500" fill="none" stroke="var(--zinc-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ boxSizing: 'border-box', transformOrigin: '0px 0px' }} />
                                                    <rect x="3" y="3" width="18" height="18" rx="2" fontSize="14px" fontWeight="500" fill="none" stroke="var(--zinc-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ height: '18px', boxSizing: 'border-box', width: '18px', transformOrigin: '0px 0px' }} />
                                                  </svg>
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                      <div className="items-center flex shrink-0 justify-center rounded-md bg-zinc-800 border border-solid border-[#00000000] size-7">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" fontSize="14px" fontWeight="500" style={{ height: '14px', flexShrink: '0', width: '14px', opacity: '0.7', overflow: 'clip' }}>
                                          <path d="M3 7V5a2 2 0 0 1 2-2h2" fontSize="14px" fontWeight="500" fill="none" stroke="var(--zinc-50)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ boxSizing: 'border-box', transformOrigin: '0px 0px' }} />
                                          <path d="M17 3h2a2 2 0 0 1 2 2v2" fontSize="14px" fontWeight="500" fill="none" stroke="var(--zinc-50)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ boxSizing: 'border-box', transformOrigin: '0px 0px' }} />
                                          <path d="M21 17v2a2 2 0 0 1-2 2h-2" fontSize="14px" fontWeight="500" fill="none" stroke="var(--zinc-50)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ boxSizing: 'border-box', transformOrigin: '0px 0px' }} />
                                          <path d="M7 21H5a2 2 0 0 1-2-2v-2" fontSize="14px" fontWeight="500" fill="none" stroke="var(--zinc-50)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ boxSizing: 'border-box', transformOrigin: '0px 0px' }} />
                                          <rect width="10" height="8" x="7" y="8" rx="1" fontSize="14px" fontWeight="500" fill="none" stroke="var(--zinc-50)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ height: '8px', boxSizing: 'border-box', width: '10px', transformOrigin: '0px 0px' }} />
                                        </svg>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="border-b border-b-solid border-b-zinc-800">
                              <div className="items-center h-7 flex justify-between px-4 my-2">
                                <div className="text-sm leading-[142.857%] font-sans font-medium text-zinc-50">
                                  Fill
                                </div>
                              </div>
                              <div className="pb-4 px-4">
                                <div className="">
                                  <div className="items-center flex gap-2">
                                    <div className="items-center h-7 flex basis-[0%] grow px-1.5 rounded-sm gap-2 bg-[#27272A99]">
                                      <div className="shrink-0 rounded-[3px] overflow-clip relative size-5">
                                        <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(in oklab 45deg, oklab(60% 0 0) 25%, oklab(0% 0 0 / 0%) 25%), linear-gradient(in oklab 315deg, oklab(60% 0 0) 25%, oklab(0% 0 0 / 0%) 25%), linear-gradient(in oklab 45deg, oklab(0% 0 0 / 0%) 75%, oklab(60% 0 0) 75%), linear-gradient(in oklab 315deg, oklab(0% 0 0 / 0%) 75%, oklab(60% 0 0) 75%)' }} />
                                        <div className="absolute bg-white inset-0" />
                                        <div className="rounded-[3px] absolute [box-shadow:#FFFFFF33_0px_0px_0px_1px_inset] inset-0" />
                                      </div>
                                      <div className="text-xs leading-[133.333%] text-center font-sans flex [-webkit-box-orient:vertical] [-webkit-line-clamp:1] overflow-hidden justify-center flex-wrap text-zinc-50">
                                        #FFFFFF
                                      </div>
                                    </div>
                                    <div className="items-center flex shrink-0 justify-center rounded-md bg-zinc-800 border border-solid border-[#00000000] size-7">
                                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" fontSize="14px" fontWeight="500" style={{ height: '14px', flexShrink: '0', width: '14px', opacity: '0.7', overflow: 'clip' }}>
                                        <path d="M5 12h14" fontSize="14px" fontWeight="500" fill="none" stroke="var(--zinc-50)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ boxSizing: 'border-box', transformOrigin: '0px 0px' }} />
                                      </svg>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="w-2 -left-1 absolute inset-y-0">
                  <div className="h-full w-px mx-auto" />
                </div>
              </div>
              <div className="-bottom-0.75 flex flex-col w-60.75 top-13.5 left-0 absolute bg-zinc-900 border-r border-r-solid border-r-zinc-800">
                <div className="flex basis-[0%] flex-col grow overflow-clip relative">
                  <div className="absolute inset-0">
                    <div className="h-full">
                      <div className="overflow-clip size-full">
                        <div className="table min-w-full">
                          <div className="p-2">
                            <div className="">
                              <div className="">
                                <div className="items-center h-7 flex pr-1 gap-1 rounded-t-sm">
                                  <div className="items-center flex shrink-0 p-0.5 rounded-sm">
                                    <div className="items-center flex justify-center shrink-0 size-3">
                                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" fontSize="16px" style={{ height: '12px', width: '12px', overflow: 'clip', flexShrink: '0' }}>
                                        <path d="m6 9 6 6 6-6" fontSize="16px" fill="none" stroke="var(--zinc-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ boxSizing: 'border-box', transformOrigin: '0px 0px' }} />
                                      </svg>
                                    </div>
                                  </div>
                                  <div className="items-center flex basis-[0%] grow overflow-clip gap-1.5">
                                    <div className="items-center flex shrink-0 justify-center size-3.5">
                                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" fontSize="16px" style={{ height: '14px', width: '14px', overflow: 'clip', flexShrink: '0' }}>
                                        <rect width="14" height="20" x="5" y="2" rx="2" ry="2" fontSize="16px" fill="none" stroke="var(--zinc-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ height: '20px', boxSizing: 'border-box', width: '14px', transformOrigin: '0px 0px' }} />
                                        <path d="M12 18h.01" fontSize="16px" fill="none" stroke="var(--zinc-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ boxSizing: 'border-box', transformOrigin: '0px 0px' }} />
                                      </svg>
                                    </div>
                                    <div className="text-xs leading-[133.333%] font-sans font-medium text-zinc-50 line-clamp-1">
                                      Screen
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div className="">
                                <div className="items-center h-7 flex pr-1 pl-4 gap-1 rounded-t-sm">
                                  <div className="items-center flex shrink-0 p-0.5 rounded-sm">
                                    <div className="items-center flex justify-center shrink-0 size-3">
                                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" fontSize="16px" style={{ height: '12px', width: '12px', overflow: 'clip', flexShrink: '0' }}>
                                        <path d="m6 9 6 6 6-6" fontSize="16px" fill="none" stroke="var(--zinc-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ boxSizing: 'border-box', transformOrigin: '0px 0px' }} />
                                      </svg>
                                    </div>
                                  </div>
                                  <div className="items-center flex basis-[0%] grow overflow-clip gap-1.5">
                                    <div className="items-center flex shrink-0 justify-center size-3.5">
                                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" fontSize="16px" style={{ height: '14px', width: '14px', overflow: 'clip', flexShrink: '0' }}>
                                        <rect width="18" height="18" x="3" y="3" rx="2" fontSize="16px" fill="none" stroke="var(--zinc-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ height: '18px', boxSizing: 'border-box', width: '18px', transformOrigin: '0px 0px' }} />
                                        <path d="M3 12h18" fontSize="16px" fill="none" stroke="var(--zinc-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ boxSizing: 'border-box', transformOrigin: '0px 0px' }} />
                                      </svg>
                                    </div>
                                    <div className="text-xs leading-[133.333%] font-sans font-medium text-zinc-50 line-clamp-1">
                                      Column
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div className="">
                                <div className="items-center h-7 flex pr-1 pl-8 gap-1 rounded-t-sm">
                                  <div className="items-center flex shrink-0 p-0.5 rounded-sm">
                                    <div className="shrink-0 size-3" />
                                  </div>
                                  <div className="items-center flex basis-[0%] grow overflow-clip gap-1.5">
                                    <div className="items-center flex shrink-0 justify-center size-3.5">
                                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" fontSize="16px" style={{ height: '14px', width: '14px', overflow: 'clip', flexShrink: '0' }}>
                                        <path d="M12 4v16" fontSize="16px" fill="none" stroke="var(--zinc-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ boxSizing: 'border-box', transformOrigin: '0px 0px' }} />
                                        <path d="M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2" fontSize="16px" fill="none" stroke="var(--zinc-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ boxSizing: 'border-box', transformOrigin: '0px 0px' }} />
                                        <path d="M9 20h6" fontSize="16px" fill="none" stroke="var(--zinc-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ boxSizing: 'border-box', transformOrigin: '0px 0px' }} />
                                      </svg>
                                    </div>
                                    <div className="text-xs leading-[133.333%] font-sans font-medium text-zinc-50 line-clamp-1">
                                      Text
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div className="">
                                <div className="items-center h-7 flex pr-1 pl-4 gap-1 rounded-t-sm">
                                  <div className="items-center flex shrink-0 p-0.5 rounded-sm">
                                    <div className="items-center flex justify-center shrink-0 size-3">
                                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" fontSize="16px" style={{ height: '12px', width: '12px', overflow: 'clip', flexShrink: '0' }}>
                                        <path d="m6 9 6 6 6-6" fontSize="16px" fill="none" stroke="var(--zinc-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ boxSizing: 'border-box', transformOrigin: '0px 0px' }} />
                                      </svg>
                                    </div>
                                  </div>
                                  <div className="items-center flex basis-[0%] grow overflow-clip gap-1.5">
                                    <div className="items-center flex shrink-0 justify-center size-3.5">
                                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" fontSize="16px" style={{ height: '14px', width: '14px', overflow: 'clip', flexShrink: '0' }}>
                                        <path d="M3 2h18" fontSize="16px" fill="none" stroke="var(--zinc-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ boxSizing: 'border-box', transformOrigin: '0px 0px' }} />
                                        <rect width="18" height="12" x="3" y="6" rx="2" fontSize="16px" fill="none" stroke="var(--zinc-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ height: '12px', boxSizing: 'border-box', width: '18px', transformOrigin: '0px 0px' }} />
                                        <path d="M3 22h18" fontSize="16px" fill="none" stroke="var(--zinc-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ boxSizing: 'border-box', transformOrigin: '0px 0px' }} />
                                      </svg>
                                    </div>
                                    <div className="text-xs leading-[133.333%] font-sans font-medium text-zinc-50 line-clamp-1">
                                      ScrollView
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div className="">
                                <div className="items-center h-7 flex pr-1 pl-8 gap-1 rounded-t-sm">
                                  <div className="items-center flex shrink-0 p-0.5 rounded-sm">
                                    <div className="shrink-0 size-3" />
                                  </div>
                                  <div className="items-center flex basis-[0%] grow overflow-clip gap-1.5">
                                    <div className="items-center flex shrink-0 justify-center size-3.5">
                                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" fontSize="16px" style={{ height: '14px', width: '14px', overflow: 'clip', flexShrink: '0' }}>
                                        <path d="M12 4v16" fontSize="16px" fill="none" stroke="var(--zinc-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ boxSizing: 'border-box', transformOrigin: '0px 0px' }} />
                                        <path d="M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2" fontSize="16px" fill="none" stroke="var(--zinc-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ boxSizing: 'border-box', transformOrigin: '0px 0px' }} />
                                        <path d="M9 20h6" fontSize="16px" fill="none" stroke="var(--zinc-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ boxSizing: 'border-box', transformOrigin: '0px 0px' }} />
                                      </svg>
                                    </div>
                                    <div className="text-xs leading-[133.333%] font-sans font-medium text-zinc-50 line-clamp-1">
                                      Text
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div className="">
                                <div className="items-center h-7 flex pr-1 pl-8 gap-1 rounded-t-sm">
                                  <div className="items-center flex shrink-0 p-0.5 rounded-sm">
                                    <div className="shrink-0 size-3" />
                                  </div>
                                  <div className="items-center flex basis-[0%] grow overflow-clip gap-1.5">
                                    <div className="items-center flex shrink-0 justify-center size-3.5">
                                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" fontSize="16px" style={{ height: '14px', width: '14px', overflow: 'clip', flexShrink: '0' }}>
                                        <path d="M12 4v16" fontSize="16px" fill="none" stroke="var(--zinc-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ boxSizing: 'border-box', transformOrigin: '0px 0px' }} />
                                        <path d="M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2" fontSize="16px" fill="none" stroke="var(--zinc-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ boxSizing: 'border-box', transformOrigin: '0px 0px' }} />
                                        <path d="M9 20h6" fontSize="16px" fill="none" stroke="var(--zinc-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ boxSizing: 'border-box', transformOrigin: '0px 0px' }} />
                                      </svg>
                                    </div>
                                    <div className="text-xs leading-[133.333%] font-sans font-medium text-zinc-50 line-clamp-1">
                                      Text
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div className="">
                                <div className="items-center h-7 flex pr-1 pl-8 gap-1 rounded-t-sm">
                                  <div className="items-center flex shrink-0 p-0.5 rounded-sm">
                                    <div className="shrink-0 size-3" />
                                  </div>
                                  <div className="items-center flex basis-[0%] grow overflow-clip gap-1.5">
                                    <div className="items-center flex shrink-0 justify-center size-3.5">
                                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" fontSize="16px" style={{ height: '14px', width: '14px', overflow: 'clip', flexShrink: '0' }}>
                                        <path d="M10 22V7a1 1 0 0 0-1-1H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5a1 1 0 0 0-1-1H2" fontSize="16px" fill="none" stroke="var(--zinc-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ boxSizing: 'border-box', transformOrigin: '0px 0px' }} />
                                        <rect x="14" y="2" width="8" height="8" rx="1" fontSize="16px" fill="none" stroke="var(--zinc-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ height: '8px', boxSizing: 'border-box', width: '8px', transformOrigin: '0px 0px' }} />
                                      </svg>
                                    </div>
                                    <div className="text-xs leading-[133.333%] font-sans font-medium text-zinc-50 line-clamp-1">
                                      Sample Badge
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div className="">
                                <div className="items-center h-7 flex pr-1 pl-4 rounded-sm gap-1">
                                  <div className="items-center flex shrink-0 p-0.5 rounded-sm">
                                    <div className="shrink-0 size-3" />
                                  </div>
                                  <div className="items-center flex basis-[0%] grow overflow-clip gap-1.5">
                                    <div className="items-center flex shrink-0 justify-center size-3.5">
                                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" fontSize="16px" style={{ height: '14px', width: '14px', overflow: 'clip', flexShrink: '0' }}>
                                        <path d="M12 4v16" fontSize="16px" fill="none" stroke="var(--zinc-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ boxSizing: 'border-box', transformOrigin: '0px 0px' }} />
                                        <path d="M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2" fontSize="16px" fill="none" stroke="var(--zinc-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ boxSizing: 'border-box', transformOrigin: '0px 0px' }} />
                                        <path d="M9 20h6" fontSize="16px" fill="none" stroke="var(--zinc-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ boxSizing: 'border-box', transformOrigin: '0px 0px' }} />
                                      </svg>
                                    </div>
                                    <div className="text-xs leading-[133.333%] font-sans font-medium text-zinc-50 line-clamp-1">
                                      Text
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="w-2 -right-1 absolute inset-y-0">
                  <div className="h-full w-px mx-auto" />
                </div>
              </div>
              <div className="w-342 h-186 top-0 left-0 absolute" style={{ backgroundImage: 'radial-gradient(ellipse 50.4% 92.66499999999999% at 50% -5.790000000000006% in oklab, oklab(18.2% 0 0 / 0%) 0.14%, oklab(14.1% 0.001 -0.004) 100%)' }} />
            </div>
          </div>
          <PaywallBuild />
          </div>
        </ScaledMock>
      </div>
      <div className="h-20 border-zinc-800 border-t md:h-35.25" />
    </LandingSection>
  );
}
