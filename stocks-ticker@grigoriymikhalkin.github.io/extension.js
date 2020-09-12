'use strict';

const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Mainloop = imports.mainloop;
const Util = imports.misc.util;

const {St, Clutter, GObject, Gio} = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils
const Me = ExtensionUtils.getCurrentExtension()
const GoogleClient = Me.imports.googleClient.GoogleClient;


let stocksTicker, timeout;

// function setStockIndicator() {
//   counter++;
//   if (counter % 2 === 0) {
//     panelButtonText.set_text("INL - 43.2 ▲1.2%");
//   } else {
//     panelButtonText.set_text("NVD - 555.2$ ▲3.2%");
//   }
//   return true;
// }

const ScrollMenu = class extends PopupMenu.PopupMenuBase {
  constructor(menu, styleClass) {
    super(menu);
    this.box = new St.BoxLayout({
      style_class: styleClass,
      vertical: true
    });

    this.actor = new St.ScrollView({
      style_class: 'scroll-menu',
      hscrollbar_policy: St.PolicyType.NEVER,
      vscrollbar_policy: St.PolicyType.NEVER
    });
    this.actor.add_actor(this.box);
  }
}

const StocksTicker = GObject.registerClass(
  class StocksTicker extends PanelMenu.Button {
    _init() {
      super._init(0);

      this._client = new GoogleClient();

      this._load_data();

      const infoBox = this._create_info_box();
      const menuBtnBox = this._create_menu_btn_box();

      this._box = new St.BoxLayout({
        vertical: true,
      });
      this._box.add_actor(infoBox);
      this._box.add_actor(menuBtnBox);

      const menuItem = new PopupMenu.PopupBaseMenuItem({
        reactive: false
      });
      menuItem.add_actor(this._box);
      this.menu.addMenuItem(menuItem);
    }

    _load_data() {
      const ctx = this;

      this._client.get_prices_update(
        ['/g/1dv30z_t', '/m/0ckrtns'],
        (priceUpdates) => {
          ctx._data = priceUpdates;
          ctx._set_label();
        }
      );
    }

    _set_label() {
      const priceUpdate = this._data['/g/1dv30z_t'];
      const isChangeNegative = priceUpdate['change'] === ' NEGATIVE';

      if (this._label) {
        this.remove_child(this._label);
      }
      this._label = new St.Label({
        style_class: "status-text" + (isChangeNegative ? ' down-status-text' : ' up-status-text'),
        text: priceUpdate['symbol'] + " - " + priceUpdate['price'] +
          (isChangeNegative ? '  ▼' : '  ▲') + priceUpdate['percent_change']
      });
      this.add_child(this._label);
    }

    _create_info_box() {
      const infoBox = new St.BoxLayout({
        vertical: true,
        x_expand: true,
        y_expand: true,
        y_align: Clutter.ActorAlign.START
      });

      let lb = new St.Label({
        style_class: "status-text",
        text: "INL - 43.2 ▲1.2%"
      });
      infoBox.add_actor(lb);

      const scrollView = new St.ScrollView({
        hscrollbar_policy: St.PolicyType.NEVER,
        vscrollbar_policy: St.PolicyType.AUTOMATIC,
        overlay_scrollbars: true, x_expand: true, y_expand: true,
      });
      scrollView.add_actor(infoBox);

      return scrollView;
    }

    _create_menu_btn_box() {
      const ctx = this;
      const menuBtnBox = new St.BoxLayout({});

      const settingsIcon = new St.Icon({
        icon_name: 'emblem-system-symbolic',
        style_class: 'popup-menu-icon'
      });
      const settingsBtn = new St.Button({
        reactive: true,
        can_focus: true,
        track_hover: true,
        accessible_name: "hatt2",
        style_class: 'system-menu-action',
        child: settingsIcon
      });
      settingsBtn.connect('clicked', () => {
        Util.spawn(['gnome-shell-extension-prefs', 'stocks-ticker@grigoriymikhalkin.github.io']);
      });
      menuBtnBox.add_actor(settingsBtn);

      return menuBtnBox;
    }
  }
);

function init() {}

function enable() {
  stocksTicker = new StocksTicker();
  Main.panel.addToStatusArea('stocksTicker',stocksTicker, 0, 'center');
  // timeout = Mainloop.timeout_add_seconds(2.0, setStockIndicator);
}

function disable() {
  Mainloop.source_remove(timeout);
  Main.panel._centerBox.remove_child(stocksTicker);
}
