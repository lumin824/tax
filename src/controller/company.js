'use strict';

import Base from './base.js';
import _ from 'lodash';
import moment from 'moment';

import JsdsAPI from '../sysapi/jsds';
import JsgsAPI from '../sysapi/jsgs';
import CcAPI from '../sysapi/cc';

export default class extends Base {
  async indexAction(){
    let { id } = this.param();
    if(id){
      let item = await this.model('company').where({id}).find();
      let levelList = await this.model('company_level').where({company_id:id,is_visible:1}).select();
      this.assign({item,levelList});
      return this.display();
    }
    else{
      let { keyword } = this.param();
      let result = await this.model('company').where({'name':['LIKE',`%${keyword}%`]}).page(1,20).select();
      this.assign({result});
      return this.display('list');
    }
  }

  async checkAction(){
    let { id } = this.param();
    let item = await this.model('company_check').where({id}).find();
    if(item.from == '江苏国税')
    {
      this.assign(JSON.parse(item.fetch_info));
      return this.display('jsgs/show');
    }
    return this.display();
  }

  async applyAction(){
    if(this.isGet()){
      let { id } = this.param();
      if(id){
        let item = await this.model('company_apply').where({id}).find();
        this.assign({item});
      }
      return this.display();
    }else{
      let { id, ...data } = this.param();
      let ret = {};
      let current_unix = moment().unix();
      if(id){
        data.update_time = current_unix;
        await this.model('company_apply').where({id}).update(data);
        ret.reload = true;
      }else{
        data.create_time = current_unix;
        data.update_time = current_unix;
        id = await this.model('company_apply').add(data);
        ret.redirect = `/company/apply?id=${id}`;
      }
      let gs_api = new JsgsAPI(),
          ds_api = new JsdsAPI();

      let login_success = true;
      {
        let username = data.gs_username || data.uscc;
        let {errno:gs_errno,errmsg:gs_errmsg} = await gs_api.login(username, data.gs_password);
        while(~gs_errmsg.indexOf('验证码')){
          ({errno:gs_errno,errmsg:gs_errmsg} = await gs_api.login(username, data.gs_password));
        }
        if(gs_errno != '0') login_success = false;
        this.model('company_apply').where({id}).update({gs_errno, gs_errmsg});
      }
      {
        let username = data.ds_username || data.uscc;
        let {errno:ds_errno,errmsg:ds_errmsg} = await ds_api.login(username, data.ds_password);
        if(ds_errno != '0') login_success = false;
        this.model('company_apply').where({id}).update({ds_errno, ds_errmsg});
      }

      if(login_success){

        let gs_data = await gs_api.data(),
            ds_data = await ds_api.data();

        let result = {
          gs_data,
          ds_data,
          taxList: _.sortBy([...gs_data.taxList, ...ds_data.taxList],'time'),
          info: {
            ...ds_data.info, ...gs_data.info
          }
        };

        // let cc_api = new CcAPI();
        // let ccList = await cc_api.search({
        //   keyword:result.info.name
        // });
        //
        // let ccInfo = _.find(ccList, {name:result.info.name});
        // ccInfo = await cc_api.detail(ccInfo);

        result = JSON.stringify(result);
        this.model('company_apply').where({id}).update({result});
        ret.redirect = `/company/apply_result?id=${id}`;
      }

      return this.success(ret);
    }
  }

  async applyResultAction(){
    let { id } = this.param();
    let item = await this.model('company_apply').where({id}).find();
    this.assign({item, resultJson:JSON.parse(item.result)});
    return this.display();
  }
}
