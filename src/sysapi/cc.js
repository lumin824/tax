
import Base from './base';
import _ from 'lodash';

export default class extends Base {

  async search(form){
    let default_form = {
      keyword:'',searchtype:'0',objectType:'2',areas:'',creditType:'',
      dataType:'1',areaCode:'',templateId:'',exact:'0',page:'1'
    };
    let headers = { 'User-Agent':'request', 'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8' };
    let res = await this.httpPost('http://www.creditchina.gov.cn/credit_info_search', {
      form:{...default_form,...form},headers
    })
    return JSON.parse(res.body).result.results;
  }

  async detail(qs){
    let { objectType, encryStr } = qs;
    let res = await this.httpGet('http://www.creditchina.gov.cn/credit_info_detail', {
      qs: { objectType, encryStr}, headers: { 'User-Agent':'request' }
    });

    let $ = cheerio.load(res.body);

    let infos = _.map($('div.creditsearch-tagsinfo').toArray(),
      o=>_.map($(o).find('ul.creditsearch-tagsinfo-ul').toArray(),
        o2=>_.map($(o2).find('li.oneline').toArray(),
          o3=>_.trim($(o3).text())
        )
      )
    );

    // 负面记录
    let fmjl = _.map(infos[2],o=>{
      let wfss = _.find(o,o2=>_.startsWith(o2,'主要违法事实'));
      let frxm = _.find(o,o2=>_.startsWith(o2,'法定代表人或者负责人姓名'));
      let cfqk = _.find(o,o2=>_.startsWith(o2,'相关法律依据及处理处罚情况'));
      let je = 0;
      let m = cfqk.match(/(\d+(?:\.\d+)?)(元|千元|万元|十万元|百万元|千万元|亿元)/);
      if(m){
        je = parseFloat(m[1]);
        if(m[2]=='千元')        je*=1e3;
        else if(m[2]=='万元')   je*=1e4;
        else if(m[2]=='十万元') je*=1e5;
        else if(m[2]=='百万元') je*=1e6;
        else if(m[2]=='千万元') je*=1e7;
        else if(m[2]=='亿元')   je*=1e8;
      }
      return { wfss, cfqk, je, frxm };
    });

    // 受惩黑名单
    let schmd = _.map(infos[3], o=>{
      // 最高法
      let ah = _.find(o,o2=>_.startsWith(o2,'案号'));
      let frxm = _.find(o,o2=>_.startsWith(o2,'企业法人姓名'));
      let qdyw = _.find(o,o2=>_.startsWith(o2,'法律生效文书确定的义务'));
      // 财政部
      let blxw = _.find(o,o2=>_.startsWith(o2,'不良行为的具体情形'));
      let cfjg = _.find(o,o2=>_.startsWith(o2,'处罚结果'));

      let je = 0;
      let m;
      if(qdyw && (m = qdyw.match(/(\d+(?:\.\d+)?)(元|千元|万元|十万元|百万元|千万元|亿元)/))){
        je = parseFloat(m[1]);
        if(m[2]=='千元')        je*=1e3;
        else if(m[2]=='万元')   je*=1e4;
        else if(m[2]=='十万元') je*=1e5;
        else if(m[2]=='百万元') je*=1e6;
        else if(m[2]=='千万元') je*=1e7;
        else if(m[2]=='亿元')   je*=1e8;
      }else if(cfjg && (m = cfjg.match(/(\d+(?:\.\d+)?)(元|千元|万元|十万元|百万元|千万元|亿元)/))){
        je = parseFloat(m[1]);
        if(m[2]=='千元')        je*=1e3;
        else if(m[2]=='万元')   je*=1e4;
        else if(m[2]=='十万元') je*=1e5;
        else if(m[2]=='百万元') je*=1e6;
        else if(m[2]=='千万元') je*=1e7;
        else if(m[2]=='亿元')   je*=1e8;
      }
      return { ah, frxm, qdyw, blxw, cfjg, je};
    });

    return {fmjl, schmd};
  }
}
