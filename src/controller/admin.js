'use strict';

import Base from './base.js';
import moment from 'moment';
import _ from 'lodash';

export default class extends Base {

  async __before(){
    let user = await this.session('user');
    if(think.isEmpty(user))
      return this.redirect(`/auth/login?ret=${this.http.url}`);
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

    if(this.isGet()){
      let { id } = this.param();
      if(id){
        let item = await this.model('user').where({id}).find();
        this.assign({item});
      }
      return this.display();
    }else{
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


  async companyApplyAction(){
    if(this.isGet()){
      return this.display();
    }else{
      let {page, rows, searchField, searchString, searchOper, sidx, sord, key} = this.param();
      let { review_status } = this.param();
      let where = {};

      if(review_status){
        where.review_status = review_status.split(',');
      }

      let dao = this.model('company_apply')
        .field('id','name','uscc','create_time','review_status','update_time')
        .page(page, rows);
      if(_.size(where) > 0)
        dao.where(where);
      let data = await dao.countSelect();
      return this.json({
        page: data.currentPage,
        records: data.count,
        rows: data.data,
        total: data.totalPages,
      });
    }
  }

  async companyApplyEditAction(){

    if(this.isGet()){
      let { id } = this.param();

      let item = await this.model('company_apply').where({id}).find();
      let resultJson = JSON.parse(item.result || '{}');
      let { taxValue } = resultJson;
      let curYear = moment().year();
      this.assign({item,resultJson,taxValue, taxValueKey:[curYear,curYear-1,curYear-2,curYear-3]});
      return this.display();
    }else{
      let { id, oper, ...data } = this.param();
      if(oper == 'edit_taxList'){
        data = _.mapValues(data, (o,k)=>{
          let ks = k.split('_');
          return {
            year:ks[0],
            [ks[1]]:o?parseFloat(o):0
          }
        });
        data = _.groupBy(data, 'year');
        data = _.mapValues(data, o=>{
          let { year, ...v} = _.merge(...o);
          return {
            ...v,
            tax:v.tax ? v.tax.toFixed(2) : '0.00',
            ts:v.tax > 1000 ? (Math.log(v.tax/1000)/Math.log(10)).toFixed(2) : '0.00',
            ga:(v.assets && v.tax) ? (100*v.tax/v.assets).toFixed(2) : '0.00',
            ge:(v.equity && v.tax) ? (100*v.tax/v.equity).toFixed(2) : '0.00',
            gi:(v.interest && v.tax) ? (v.tax/v.interest).toFixed(2) :'0.00',
            gl:(v.liability && v.tax) ? (100*v.tax/v.liability).toFixed(2) : '0.00',
            gr:(v.revenue && v.tax) ? (100*v.tax/v.revenue).toFixed(2) : '0.00',
            gc:(v.capital && v.tax) ? (100*v.tax/v.capital).toFixed(2) : '0.00',
          }
        });
        let item = await this.model('company_apply').where({id}).find();
        let resultJson = JSON.parse(item.result || '{}');
        resultJson.taxValue = {
          ...resultJson.taxValue,
          ...data
        };
        await this.model('company_apply').where({id}).update({
          result: JSON.stringify(resultJson),
          update_time: moment().unix(),
          review_status: '2'
        })
        return this.success({back:true});
      }else if(oper == 'del'){
        await this.model('company_apply').where({id:id.split(',')}).delete();
        return this.success();
      }

    }
  }

  async articleAction(){
    if(this.isGet()){
      return this.display();
    }else{
      let {page, rows, searchField, searchString, searchOper, sidx, sord, key} = this.param();
      let data = await this.model('article').page(page, rows).countSelect();
      return this.json({
        page: data.currentPage,
        records: data.count,
        rows: data.data,
        total: data.totalPages,
      });
    }
  }

  async articleEditAction(){
    if(this.isGet()){
      let { id } = this.param();
      if(id){
        let item = await this.model('article').where({id}).find();
        this.assign({item});
      }
      return this.display();
    }else{
      let { oper, id, ...data} = this.param();
      if(oper == 'edit'){
        await this.model('article').where({id}).update(data);
      }else if(oper == 'add'){
        //if(!data.password) data.password = '123456';
        await this.model('article').add(data);
      }else if(oper == 'del'){
        await this.model('article').where({id:id.split(',')}).delete();
      }
      return this.success({});
    }
  }

  async taskCountAction(){

    let ret = {
      apply: {
        review_status_1: await this.model('company_apply').where({review_status:'1'}).count()
      }
    }
    return this.success(ret);
  }
}
