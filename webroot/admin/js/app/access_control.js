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
    const slidesMaster = document.getElementById('slidesMaster');
    const contentSaunasBox = document.getElementById('boxSaunas');
    const footnoteBox = document.getElementById('boxFootnotes');
    const footnoteSection = document.getElementById('footnoteSection');
    const footnoteLayoutSection = document.getElementById('footnoteLayoutSection');
    const badgeSection = document.getElementById('badgeLibrarySection');
    const globalInfoBox = document.getElementById('boxStories');
    const infoWellness = document.getElementById('infoWellness');
    const infoEvents = document.getElementById('infoEvents');
    const infoModules = document.getElementById('infoModules');
    const infoStories = document.getElementById('infoStories');
    const mediaBox = document.getElementById('boxImages');
    const slideshowModule = document.getElementById('boxSlidesText');
    const slidesAutomationCard = document.getElementById('slidesAutomationCard');
    const backgroundAudioCard = document.getElementById('backgroundAudioCard');
    const displayLayoutFold = document.getElementById('displayLayoutFold');
    const designModule = document.getElementById('designEditor');
    const stylePaletteFold = document.getElementById('stylePaletteFold');
    const typographyFold = document.getElementById('boxTypographyLayout');
    const colorsSection = document.getElementById('resetColors')?.closest('details');
    const systemSection = document.getElementById('btnExport')?.closest('details');

    const cockpitCardFrom = (selector) => {
      const control = document.querySelector(selector);
      return control ? control.closest('.workspace-card') : null;
    };

    const slidesCockpitCard = cockpitCardFrom('[data-jump="slidesMaster"]');
    const infoCockpitCard = cockpitCardFrom('[data-jump="boxStories"]');
    const mediaLayoutCard = cockpitCardFrom('[data-jump="boxImages"]') || cockpitCardFrom('[data-jump="boxSlidesText"]');

    const canUseCockpit = hasPermission('cockpit');
    const canAccessContentModule = hasPermission('module-content');
    const canAccessSaunas = canAccessContentModule && hasPermission('content-saunas');
    const canAccessFootnotes = canAccessContentModule && hasPermission('content-footnotes');
    const canAccessBadges = canAccessContentModule && hasPermission('content-badges');
    const canAccessGlobalInfo = canAccessContentModule && hasPermission('content-global');
    const canAccessGlobalWellness = canAccessGlobalInfo && hasPermission('content-global-wellness');
    const canAccessGlobalEvents = canAccessGlobalInfo && hasPermission('content-global-events');
    const canAccessGlobalModules = canAccessGlobalInfo && hasPermission('content-global-modules');
    const canAccessGlobalStories = canAccessGlobalInfo && hasPermission('content-global-stories');
    const canAccessMedia = canAccessContentModule && hasPermission('content-media');
    const canAccessSlideshowModule = hasPermission('module-slideshow');
    const canAccessAutomation = canAccessSlideshowModule && hasPermission('slideshow-automation');
    const canAccessAudio = canAccessSlideshowModule && hasPermission('slideshow-audio');
    const canAccessDisplay = canAccessSlideshowModule && hasPermission('slideshow-display');
    const canAccessDesignModule = hasPermission('module-design');
    const canAccessPalettes = canAccessDesignModule && hasPermission('design-palettes');
    const canAccessTypography = canAccessDesignModule && hasPermission('design-typography');
    const canAccessColors = canAccessDesignModule && hasPermission('design-colors');
    const canAccessSystem = hasPermission('module-system');
    const canManageDevices = hasPermission('devices');
    const canManageUsers = hasPermission('user-admin');

    setHiddenState(cockpitToggle, !canUseCockpit);
    setHiddenState(cockpitSection, !canUseCockpit);
    setHiddenState(slidesMaster, !canAccessContentModule);
    setHiddenState(contentSaunasBox, !canAccessSaunas);
    const showFootnoteBox = canAccessFootnotes || canAccessBadges;
    setHiddenState(footnoteBox, !(canAccessContentModule && showFootnoteBox));
    setHiddenState(footnoteSection, !(canAccessContentModule && canAccessFootnotes));
    setHiddenState(footnoteLayoutSection, !(canAccessContentModule && canAccessFootnotes));
    setHiddenState(badgeSection, !(canAccessContentModule && canAccessBadges));
    const showGlobalInfoBox = canAccessContentModule && canAccessGlobalInfo
      && (canAccessGlobalWellness || canAccessGlobalEvents || canAccessGlobalModules || canAccessGlobalStories);
    setHiddenState(globalInfoBox, !showGlobalInfoBox);
    setHiddenState(infoWellness, !(canAccessGlobalInfo && canAccessGlobalWellness));
    setHiddenState(infoEvents, !(canAccessGlobalInfo && canAccessGlobalEvents));
    setHiddenState(infoModules, !(canAccessGlobalInfo && canAccessGlobalModules));
    setHiddenState(infoStories, !(canAccessGlobalInfo && canAccessGlobalStories));
    setHiddenState(mediaBox, !(canAccessContentModule && canAccessMedia));

    setHiddenState(slideshowModule, !canAccessSlideshowModule);
    setHiddenState(slidesAutomationCard, !(canAccessSlideshowModule && canAccessAutomation));
    setHiddenState(backgroundAudioCard, !(canAccessSlideshowModule && canAccessAudio));
    setHiddenState(displayLayoutFold, !(canAccessSlideshowModule && canAccessDisplay));

    setHiddenState(designModule, !canAccessDesignModule);
    setHiddenState(stylePaletteFold, !(canAccessDesignModule && canAccessPalettes));
    setHiddenState(typographyFold, !(canAccessDesignModule && canAccessTypography));
    setHiddenState(colorsSection, !(canAccessDesignModule && canAccessColors));

    setHiddenState(systemSection, !canAccessSystem);

    if (slidesMaster) {
      if (!canAccessContentModule) {
        slidesMaster.setAttribute('data-limited', 'true');
        slidesMaster.open = true;
      } else {
        slidesMaster.removeAttribute('data-limited');
      }
    }

    const showContentCard = canAccessContentModule
      && (canAccessSaunas || canAccessFootnotes || canAccessBadges || canAccessGlobalInfo || canAccessMedia);
    const showInfoCard = showGlobalInfoBox;
    const showMediaLayoutCard = canAccessMedia || canAccessSlideshowModule || canAccessDesignModule;

    setHiddenState(slidesCockpitCard, !showContentCard);
    setHiddenState(infoCockpitCard, !showInfoCard);
    setHiddenState(mediaLayoutCard, !showMediaLayoutCard);

    const availablePermissions = getAvailablePermissions();
    const hasFullAccess = Array.isArray(availablePermissions)
      ? availablePermissions.every((permission) => hasPermission(permission))
      : false;
    document.body?.classList.toggle('role-limited', !hasFullAccess);

    if (!canAccessSlideshowModule && slideshowModule) {
      slideshowModule.open = false;
    }

    if (!canAccessDesignModule && designModule) {
      designModule.open = false;
    }

    if (!canAccessColors && colorsSection) {
      colorsSection.open = false;
    }

    if (!canAccessSystem && systemSection) {
      systemSection.open = false;
    }

    if (!showGlobalInfoBox && globalInfoBox) {
      globalInfoBox.open = false;
    }

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
