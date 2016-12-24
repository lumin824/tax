
import Base from './base';

import _ from 'lodash';
import fs from 'fs';
import gm from 'gm';
import uuid from 'node-uuid';
import tesseract from 'node-tesseract';

import cheerio from 'cheerio';
import md5File from 'md5-file';

export default class extends Base {
  fetchCaptcha(){
    let codePath = 'code_' + uuid.v1() + '.jpg';
    return new Promise((resolve, reject)=>{
      let stream = gm(this.httpClient.get('http://www.jsds.gov.cn/index/fujia2.jsp'))
        .operator('gray', 'threshold', 50, true).stream();
      stream.pipe(fs.createWriteStream(codePath));
      stream.on('end', ()=>{
        tesseract.process(codePath, (error, text)=>{
          fs.unlink(codePath);
          error ? reject(error) : resolve(_.trim(text));
        });
      });
    });
  }
  async login(username, password){

    let ret = await this.httpGet('http://wsbs.sc-n-tax.gov.cn/sso/login.html');
    let $ = cheerio.load(ret.body);
    let token = $('#token').val();
    ret = await this.httpPost('http://wsbs.sc-n-tax.gov.cn/sso/dologin.json', {
      form: {
        gotoUrl:'',token,username,pwd:password,rememberMe:'1'
      }
    });

    console.log(ret.body);
    let { msg:errmsg, code:errno} = JSON.parse(ret.body);

    if(errno == 100){
      errno = '0',
      errmsg = '';
    }else{
      if(errno == 999){
        errno = 'ERR_04';
        errmsg = '帐号或密码错误';
      }else{
        errno = 'SYS_' + errno;
      }
    }

    return {errno, errmsg};
  }

  async fetch_topmenu(){
    let ret = await this.httpPost('http://wsbs.sc-n-tax.gov.cn/common/common/topheadmenu.json')
    let result = JSON.parse(ret.body);

    console.log(result.yhzhxx);
    return result;
  }

  async fetch_dzjk(kprqq, kprqz){
    let pageSize = 1000;
    let ret = await this.httpPost('http://wsbs.sc-n-tax.gov.cn/dzjkpzcx/query.json', {
      form: { kprqq, kprqz, pageNumber:'1', pageSize}
    });

    let result = JSON.parse(ret.body);

    if(pageSize < result.pageInfo.total){
      pageSize = result.pageInfo.total;
      ret = await this.httpPost('http://wsbs.sc-n-tax.gov.cn/dzjkpzcx/query.json', {
        form: { kprqq, kprqz, pageNumber:'1', pageSize}
      });
      result = JSON.parse(ret.body);
    }

    return result.pageInfo.list;
  }

  async fetch_nsrjbxx(nsrsbh){
    let ret = await this.httpPost('http://wsbs.sc-n-tax.gov.cn/sscx/nsrjbxx/getnsrjbxx.json', {
      form: {nsrsbh}
    });

    let result = JSON.parse(ret.body);

    return result.data;
  }

  async data(){
    let topmenu = await this.fetch_topmenu();
    let dzjk = await this.fetch_dzjk();

    let nsrsbh = topmenu.yhzhxx.bdqyxx.bdnsrsbh;

    let nsrjbxx = await this.fetch_nsrjbxx(nsrsbh);

    let info = {
      nsrsbh, name: topmenu.yhzhxx.bdqyxx.bdnsrmc,
      ...nsrjbxx
    };

    let taxList = _.map(dzjk, o=>({
      name:o.zsxmmc+'-'+o.zspmmc,money:o.se,time:o.rkrq,remark:'国税-电子缴款'
    }));

    return {info,dzjk,taxList};
  }
}
