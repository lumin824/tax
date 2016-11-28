'use strict';

import Base from './base.js';
import moment from 'moment';

export default class extends Base {

  async __before(){
    let menuList = [
      {name:'用户', href:'/admin/user'},
      {name:'公司', children:[
        {name:'信息', href:'/admin/company'},
        {name:'核查', href:'/admin/company_check'}
      ]}
    ];
    this.assign({menuList});
  }

  async indexAction(){
    return this.display();
  }

  async userAction(){
    if(this.isAjax()){
      let {page, rows, searchField, searchString, searchOper, sidx, sord, key} = this.param();
      let data = await this.model('user').page(page, rows).countSelect();
      return this.json({
        page: data.currentPage,
        records: data.count,
        rows: data.data,
        total: data.totalPages,
      });
    }
    return this.display();
  }

  async userEditAction(){
    if(this.isAjax()){
      let { oper, id, ...data} = this.param();
      if(oper == 'edit'){
        await this.model('user').where({id}).update(data);
      }else if(oper == 'add'){
        if(!data.password) data.password = '123456';
        data.create_time = moment().unix();
        await this.model('user').add(data);
      }else if(oper == 'del'){
        await this.model('user').where({id:id.split(',')}).delete();
      }
      return this.success({});
    }else{
      let { id } = this.param();
      if(id){
        let item = await this.model('user').where({id}).find();
        this.assign({item});
      }
      return this.display();
    }
  }

  async companyAction(){
    if(this.isAjax()){
      let {page, rows, searchField, searchString, searchOper, sidx, sord, key} = this.param();
      let data = await this.model('company').page(page, rows).countSelect();
      return this.json({
        page: data.currentPage,
        records: data.count,
        rows: data.data,
        total: data.totalPages,
      });
    }
    return this.display();
  }

  async companyEditAction(){
    if(this.isAjax()){
      let { oper, id, ...data} = this.param();
      if(oper == 'edit'){
        await this.model('company').where({id}).update(data);
      }else if(oper == 'add'){
        //if(!data.password) data.password = '123456';
        await this.model('company').add(data);
      }else if(oper == 'del'){
        await this.model('company').where({id:id.split(',')}).delete();
      }
      return this.success({});
    }else{
      let { id } = this.param();
      if(id){
        let item = await this.model('company').where({id}).find();

        let levelList = await this.model('company_level').where({company_id:id}).select();
        this.assign({item, levelList});
      }
      return this.display();
    }
  }

  async companyCheckAction(){
    if(this.isAjax()){
      let {page, rows, searchField, searchString, searchOper, sidx, sord, key} = this.param();
      let data = await this.model('company_check')
        .field('a.*, b.name as company_name')
        .alias('a')
        .join({table:'company', as:'b', on:['a.company_id', 'b.id']})
        .page(page, rows).countSelect();
      return this.json({
        page: data.currentPage,
        records: data.count,
        rows: data.data,
        total: data.totalPages,
      });
    }
    return this.display();
  }

  async companyCheckEditAction(){
    if(this.isAjax()){
      let { oper, id, ...data} = this.param();
      if(oper == 'edit'){
        await this.model('company_check').where({id}).update(data);
      }else if(oper == 'add'){
        await this.model('company_check').add(data);
      }else if(oper == 'del'){
        await this.model('company_check').where({id:id.split(',')}).delete();
      }
      return this.success({});
    }else{
      let { id } = this.param();
      if(id){
        let item = await this.model('company_check').where({id}).find();
        let company = await this.model('company').where({id:item.company_id}).find();
        this.assign({item,company});
      }
      return this.display();
    }
  }

  async companyCheckProcessAction(){
    if(this.isAjax()){
      let { oper, id, ...data} = this.param();
      if(oper == 'change_info'){
        await this.model('company_check').where({id}).update(data);
      }else if(oper == 'import_level'){
        await this.model('company_check').add(data);
      }
      return this.success({});
    }else{
      let { id } = this.param();
      if(id){
        let item = await this.model('company_check').where({id}).find();
        item.format_json = JSON.parse(item.format_text);
        let company = await this.model('company').where({id:item.company_id}).find();
        this.assign({item,company});
      }
      return this.display();
    }
  }

  async companyLevelEditAction(){
    if(this.isAjax()){
      let { oper, id, ...data} = this.param();
      if(oper == 'edit'){
        await this.model('company_level').where({id}).update(data);
      }else if(oper == 'add'){
        await this.model('company_level').add(data);
      }else if(oper == 'del'){
        await this.model('company_level').where({id:id.split(',')}).delete();
      }
      return this.success({});
    }else{
      let { id } = this.param();
      if(id){
        let item = await this.model('company_level').where({id}).find();
        this.assign({item});
      }
      return this.display();
    }
  }

}
