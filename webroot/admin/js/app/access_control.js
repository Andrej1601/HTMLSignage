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
    const slideshowBox = document.getElementById('boxSlideshow');
    const slidesFlowCard = document.getElementById('slidesFlowCard');
    const styleBox = document.getElementById('boxStyle');
    const styleAutomationCard = document.getElementById('styleAutomationCard');
    const mediaBox = document.getElementById('boxImages');
    const designEditorBox = document.getElementById('boxDesignEditor');
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
    const mediaLayoutCard =
      cockpitCardFrom('[data-jump="boxImages"]') ||
      cockpitCardFrom('[data-jump="boxSlideshow"]') ||
      cockpitCardFrom('[data-jump="boxStyle"]') ||
      cockpitCardFrom('[data-jump="boxDesignEditor"]');

    const canUseCockpit = hasPermission('cockpit');
    const canUseSlides = hasPermission('slides');
    const canManageFlow = canUseSlides && hasPermission('slides-flow');
    const canManageStyle = hasPermission('style');
    const canManageMedia = canUseSlides && hasPermission('media');
    const canManageFootnotes = hasPermission('footnotes');
    const canManageBadges = hasPermission('badges');
    const canUseGlobalInfo = hasPermission('global-info');
    const canUseDesignEditor = hasPermission('design-editor');
    const canUseSystem = hasPermission('system');
    const canManageDevices = hasPermission('devices');
    const canManageUsers = hasPermission('user-admin');

    setHiddenState(cockpitToggle, !canUseCockpit);
    setHiddenState(cockpitSection, !canUseCockpit);
    setHiddenState(slideshowBox, !canUseSlides);
    setHiddenState(slidesFlowCard, !canManageFlow);
    setHiddenState(styleBox, !canManageStyle);
    setHiddenState(styleAutomationCard, !canManageStyle);
    setHiddenState(mediaBox, !canManageMedia);
    setHiddenState(designEditorBox, !canUseDesignEditor);
    setHiddenState(footnoteSection, !canManageFootnotes);
    setHiddenState(footnoteLayoutSection, !canManageFootnotes);
    setHiddenState(badgeSection, !canManageBadges);
    setHiddenState(globalInfoBox, !canUseGlobalInfo);
    setHiddenState(colorsSection, !canUseDesignEditor);
    setHiddenState(systemSection, !canUseSystem);

    if (slidesMaster) {
      if (!canUseSlides) {
        slidesMaster.setAttribute('data-limited', 'true');
        slidesMaster.open = true;
      } else {
        slidesMaster.removeAttribute('data-limited');
      }
    }

    const showSlidesCard = canUseSlides || canManageFlow || canManageStyle;
    const showInfoCard = canUseGlobalInfo || canManageMedia;
    const showMediaLayoutCard = canManageMedia || canUseDesignEditor || canUseSlides || canManageStyle;

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

    if (!canUseDesignEditor && colorsSection) {
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
