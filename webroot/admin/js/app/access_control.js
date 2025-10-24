export function createRoleRestrictionApplier({
  hasPermission,
  getAvailablePermissions,
  setDevicesPinned,
  lsRemove,
  destroyDevicesPane
}) {
  return function applyRoleRestrictions() {
    const setHiddenState = (element, shouldHide) => {
      if (!element) return;
      const hide = !!shouldHide;
      if (hide) {
        element.hidden = true;
        element.setAttribute('aria-hidden', 'true');
        element.classList.add('is-access-hidden');
        element.style.setProperty('display', 'none');
      } else {
        element.hidden = false;
        element.removeAttribute('aria-hidden');
        element.classList.remove('is-access-hidden');
        element.style.removeProperty('display');
      }
    };

    const cockpitToggle = document.querySelector('.header-cockpit-controls');
    const cockpitSection = document.querySelector('.workspace-overview');
    const slideshowBox = document.getElementById('boxSlidesText');
    const slidesFlowCard = document.getElementById('slidesFlowCard');
    const slidesAutomationCard = document.getElementById('slidesAutomationCard');
    const mediaBox = document.getElementById('boxImages');
    const footnoteBox = document.getElementById('boxFootnotes');
    const footnoteSection = document.getElementById('footnoteSection');
    const footnoteLayoutSection = document.getElementById('footnoteLayoutSection');
    const badgeSection = document.getElementById('badgeLibrarySection');
    const colorsSection = document.getElementById('designColors');
    const systemSection = document.getElementById('btnExport')?.closest('details');
    const globalInfoBox = document.getElementById('boxStories');
    const slidesMaster = document.getElementById('slidesMaster');

    const cockpitCardFrom = (selector) => {
      const control = document.querySelector(selector);
      return control ? control.closest('.workspace-card') : null;
    };

    const slidesCockpitCard = cockpitCardFrom('[data-jump="slidesMaster"]');
    const infoCockpitCard = cockpitCardFrom('[data-jump="boxStories"]');
    const mediaLayoutCard = cockpitCardFrom('[data-jump="boxImages"]') || cockpitCardFrom('[data-jump="boxSlidesText"]');

    const canUseCockpit = hasPermission('cockpit');
    const canUseSlides = hasPermission('slides');
    const canManageFlow = canUseSlides && hasPermission('slides-flow');
    const canManageAutomation = canUseSlides && hasPermission('slides-automation');
    const canManageMedia = canUseSlides && hasPermission('media');
    const canManageFootnotes = hasPermission('footnotes');
    const canManageBadges = hasPermission('badges');
    const canUseGlobalInfo = hasPermission('global-info');
    const canUseColors = hasPermission('colors');
    const canUseSystem = hasPermission('system');
    const canManageDevices = hasPermission('devices');
    const canManageUsers = hasPermission('user-admin');

    setHiddenState(cockpitToggle, !canUseCockpit);
    setHiddenState(cockpitSection, !canUseCockpit);
    setHiddenState(slideshowBox, !canUseSlides);
    setHiddenState(slidesFlowCard, !canManageFlow);
    setHiddenState(slidesAutomationCard, !canManageAutomation);
    setHiddenState(mediaBox, !canManageMedia);
    setHiddenState(footnoteSection, !canManageFootnotes);
    setHiddenState(footnoteLayoutSection, !canManageFootnotes);
    setHiddenState(badgeSection, !canManageBadges);
    setHiddenState(globalInfoBox, !canUseGlobalInfo);
    setHiddenState(colorsSection, !canUseColors);
    setHiddenState(systemSection, !canUseSystem);

    if (slidesMaster) {
      if (!canUseSlides) {
        slidesMaster.setAttribute('data-limited', 'true');
        slidesMaster.open = true;
      } else {
        slidesMaster.removeAttribute('data-limited');
      }
    }

    const showSlidesCard = canUseSlides || canManageFlow || canManageAutomation;
    const showInfoCard = canUseGlobalInfo || canManageMedia;
    const showMediaLayoutCard = canManageMedia || canUseColors || canUseSlides;

    setHiddenState(slidesCockpitCard, !showSlidesCard);
    setHiddenState(infoCockpitCard, !showInfoCard);
    setHiddenState(mediaLayoutCard, !showMediaLayoutCard);

    const availablePermissions = getAvailablePermissions();
    const hasFullAccess = Array.isArray(availablePermissions)
      ? availablePermissions.every((permission) => hasPermission(permission))
      : false;
    document.body?.classList.toggle('role-limited', !hasFullAccess);

    if (!canUseSlides && slideshowBox) {
      slideshowBox.open = false;
    }

    if (!canUseColors && colorsSection) {
      colorsSection.open = false;
    }

    if (!canUseSystem && systemSection) {
      systemSection.open = false;
    }

    if (!canUseGlobalInfo && globalInfoBox) {
      globalInfoBox.open = false;
    }

    const hideFootnoteBox = (!canManageFootnotes && !canManageBadges);
    setHiddenState(footnoteBox, hideFootnoteBox);

    if (!canManageDevices) {
      document.querySelectorAll('[data-devices]').forEach((element) => {
        element.remove();
      });

      const btnDevices = document.getElementById('btnDevices');
      if (btnDevices) {
        btnDevices.remove();
      }

      setDevicesPinned(false);
      lsRemove('devicesPinned');
      document.body?.classList.remove('devices-pinned');
      destroyDevicesPane();

      const devicesPane = document.getElementById('devicesPane');
      if (devicesPane) {
        devicesPane.remove();
      }

      const devicesDock = document.getElementById('devicesDock');
      if (devicesDock) {
        devicesDock.remove();
      }

      const devPrevModal = document.getElementById('devPrevModal');
      if (devPrevModal) {
        devPrevModal.remove();
      }
    }

    if (!canManageUsers) {
      const btnUsers = document.getElementById('btnUsers');
      if (btnUsers) {
        btnUsers.remove();
      }
      const userModal = document.getElementById('userModal');
      if (userModal) {
        userModal.remove();
      }
    }
  };
}
