'use strict';

const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Mainloop = imports.mainloop;
const Util = imports.misc.util;
const ExtensionUtils = imports.misc.extensionUtils;

const {St, Clutter, GObject, Gio} = imports.gi;

const Me = ExtensionUtils.getCurrentExtension();
const GoogleClient = Me.imports.googleClient.GoogleClient;


let stocksTicker, labelRefreshTimeout, dataRefreshTimeout;

const StocksTicker = GObject.registerClass(
  class StocksTicker extends PanelMenu.Button {
    _init() {
      super._init(0);

      this._refresh_cnt = 0;
      this._load_schema();

      this._client = new GoogleClient();
      this._load_data();

      this._infoBox = this._create_info_box();
      const menuBtnBox = this._create_menu_btn_box();

      this._box = new St.BoxLayout({
        vertical: true,
      });
      this._box.add_child(this._infoBox);
      this._box.add_child(menuBtnBox);

      const menuItem = new PopupMenu.PopupBaseMenuItem({
        reactive: false
      });
      menuItem.add_child(this._box);
      this.menu.addMenuItem(menuItem);
    }

    _load_schema() {
      const sss = Gio.SettingsSchemaSource;
      const schemaSource = sss.new_from_directory(
        Me.dir.get_child("schemas").get_path(),
        sss.get_default(),
        false
      );

      const schemaObj = schemaSource.lookup('org.gnome.shell.extensions.stocks-ticker', true);
      if (!schemaObj) {
        throw new Error('cannot find schema');
      }

      const settings = new Gio.Settings({settings_schema: schemaObj});
      settings.set_strv('fids', ['/g/1dv30z_t', '/m/0ckrtns'])

      this._fids = settings.get_strv('fids');
    }

    _load_data() {
      const ctx = this;

      this._client.get_prices_update(
        ctx._fids,
        (priceUpdates) => {
          log("Data refreshed");
          ctx._data = priceUpdates;
          ctx._set_label();
          ctx._set_menu();

          // Set next call
          dataRefreshTimeout = Mainloop.timeout_add_seconds(30 * 60, ctx._load_data.bind(ctx));
        }
      );
    }

    _create_label(ind) {
      const priceUpdate = this._data[this._fids[ind]];
      const isChangeNegative = priceUpdate['change'] === ' NEGATIVE';

      return new St.Label({
        style_class: "status-text" + (isChangeNegative ? ' down-status-text' : ' up-status-text'),
        text: priceUpdate['name'] + '(' + priceUpdate['symbol'] + ':' + priceUpdate['exchange'] + ')'
          + " - " + priceUpdate['price'] + priceUpdate['currency'] +
          (isChangeNegative ? '  ▼' : '  ▲') + priceUpdate['percent_change']
      });
    }

    _set_label() {
      if (this._label) {
        this.remove_child(this._label);
      }

      if (this._refresh_cnt === this._fids.length) {
        this._refresh_cnt = 0;
      }
      this._label = this._create_label(this._refresh_cnt);
      this.add_child(this._label);
      this._refresh_cnt++;

      // Set next call
      labelRefreshTimeout = Mainloop.timeout_add_seconds(10, this._set_label.bind(this));
    }

    _set_menu() {
      const infoBox = new St.BoxLayout({
        vertical: true,
        x_expand: true,
        y_expand: true,
        y_align: Clutter.ActorAlign.START
      });

      for (let i in this._fids) {
        let lb = this._create_label(i);
        infoBox.add_child(lb);
      }

      this._infoBox.add_actor(infoBox);

    }

    _create_info_box() {
      const scrollView = new St.ScrollView({
        hscrollbar_policy: St.PolicyType.NEVER,
        vscrollbar_policy: St.PolicyType.AUTOMATIC,
        overlay_scrollbars: true, x_expand: true, y_expand: true,
      });

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
      menuBtnBox.add_child(settingsBtn);

      return menuBtnBox;
    }
  }
);

function init() {}

function enable() {
  stocksTicker = new StocksTicker();
  Main.panel.addToStatusArea('stocksTicker', stocksTicker, 0, 'right');
}

function disable() {
  Mainloop.source_remove(labelRefreshTimeout);
  Mainloop.source_remove(dataRefreshTimeout);
  stocksTicker.get_parent().remove_child(stocksTicker);
  // Main.panel._centerBox.remove_child(stocksTicker);
}
