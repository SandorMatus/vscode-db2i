import { assert, describe, expect, test } from 'vitest'
import SQLTokeniser from '../tokens'
import Document from '../document';
import { StatementType } from '../types';

describe(`Basic statements`, () => {
  test('One statement, no end', () => {
    const document = new Document(`select * from sample`);
  
    expect(document.statements.length).toBe(1);
    expect(document.statements[0].tokens.length).toBe(4);
  });
  
  test('One statement, with end', () => {
    const document = new Document(`select * from sample;`);
  
    expect(document.statements.length).toBe(1);
    expect(document.statements[0].tokens.length).toBe(4);
  });
  
  test('Two statements, one end', () => {
    const document = new Document([
      `select * from sample;`,
      `select a from b.b`
    ].join(`\n`));
  
    expect(document.statements.length).toBe(2);
    expect(document.statements[0].tokens.length).toBe(4);
    expect(document.statements[1].tokens.length).toBe(6);
  });
  
  test('Two statements, both end', () => {
    const document = new Document([
      `select * from sample;`,
      `select a from b.b;`
    ].join(`\n`));
  
    expect(document.statements.length).toBe(2);
    expect(document.statements[0].tokens.length).toBe(4);
    expect(document.statements[1].tokens.length).toBe(6);
  });
  
  test('Two statements, both end, with comments', () => {
    const document = new Document([
      `select * from sample; --Yep`,
      `select a from b.b; -- Nope`
    ].join(`\n`));
  
    expect(document.statements.length).toBe(2);
    expect(document.statements[0].tokens.length).toBe(4);
    expect(document.statements[1].tokens.length).toBe(6);
  });
  
  test('Two statements, both end, with comments, trimmed', () => {
    const document = new Document([
      ``,
      `select * from sample; --Yep`,
      ``,
      ``,
      `select a from b.b; -- Nope`,
      ``,
      ``
    ].join(`\n`));
  
    expect(document.statements.length).toBe(2);
    expect(document.statements[0].tokens.length).toBe(4);
    expect(document.statements[1].tokens.length).toBe(6);
  });
});

describe(`Object references`, () => {
  test('SELECT: Simple unqualified object', () => {
    const document = new Document(`select * from sample;`);
  
    expect(document.statements.length).toBe(1);
    expect(document.statements[0].tokens.length).toBe(4);

    const statement = document.statements[0];

    const refs = statement.getObjectReferences();
    expect(refs.length).toBe(1);

    const obj = refs[0];
    expect(obj.tokens.length).toBe(1);
    expect(obj.object.name).toBe(`sample`);
    expect(obj.object.schema).toBeUndefined();
    expect(obj.alias).toBeUndefined();
  });

  test('SELECT: Simple qualified object', () => {
    const document = new Document(`select * from myschema.sample;`);
  
    expect(document.statements.length).toBe(1);
    expect(document.statements[0].tokens.length).toBe(6);

    const statement = document.statements[0];

    const refs = statement.getObjectReferences();
    expect(refs.length).toBe(1);

    const obj = refs[0];
    expect(obj.tokens.length).toBe(3);
    expect(obj.object.name).toBe(`sample`);
    expect(obj.object.schema).toBe(`myschema`);
    expect(obj.alias).toBeUndefined();
  });

  test('SELECT: Simple qualified object with alias', () => {
    const document = new Document(`select * from myschema.sample as a;`);
  
    expect(document.statements.length).toBe(1);
    expect(document.statements[0].tokens.length).toBe(8);

    const statement = document.statements[0];

    const refs = statement.getObjectReferences();
    expect(refs.length).toBe(1);

    const obj = refs[0];
    expect(obj.tokens.length).toBe(5);
    expect(obj.object.name).toBe(`sample`);
    expect(obj.object.schema).toBe(`myschema`);
    expect(obj.alias).toBe(`a`)
  });

  test('SELECT: Simple unqualified object with alias (no AS)', () => {
    const document = new Document(`select * from sample a;`);
  
    expect(document.statements.length).toBe(1);
    expect(document.statements[0].tokens.length).toBe(5);

    const statement = document.statements[0];

    const refs = statement.getObjectReferences();
    expect(refs.length).toBe(1);

    const obj = refs[0];
    expect(obj.tokens.length).toBe(2);
    expect(obj.object.name).toBe(`sample`);
    expect(obj.object.schema).toBeUndefined();
    expect(obj.alias).toBe(`a`)
  });

  test('SELECT: Simple qualified object with alias (no AS)', () => {
    const document = new Document(`select * from myschema.sample a;`);
  
    expect(document.statements.length).toBe(1);
    expect(document.statements[0].tokens.length).toBe(7);

    const statement = document.statements[0];

    const refs = statement.getObjectReferences();
    expect(refs.length).toBe(1);

    const obj = refs[0];
    expect(obj.tokens.length).toBe(4);
    expect(obj.object.name).toBe(`sample`);
    expect(obj.object.schema).toBe(`myschema`);
    expect(obj.alias).toBe(`a`)
  });

  test('SELECT: Simple qualified object with alias (system naming)', () => {
    const document = new Document(`select * from myschema/sample as a;`);
  
    expect(document.statements.length).toBe(1);
    expect(document.statements[0].tokens.length).toBe(8);

    const statement = document.statements[0];

    const refs = statement.getObjectReferences();
    expect(refs.length).toBe(1);

    const obj = refs[0];
    expect(obj.tokens.length).toBe(5);
    expect(obj.object.name).toBe(`sample`);
    expect(obj.object.schema).toBe(`myschema`);
    expect(obj.alias).toBe(`a`)
  });

  test(`SELECT JOIN: inner join`, () => {
    const query = [
      `SELECT EMPNO, LASTNAME, PROJNO`,
      `FROM CORPDATA.EMPLOYEE INNER JOIN CORPDATA.PROJECT`,
      `      ON EMPNO = RESPEMP`,
      `WHERE LASTNAME > 'S';`,
    ].join(`\n`);

    const document = new Document(query);

    expect(document.statements.length).toBe(1);

    const statement = document.statements[0];

    const refs = statement.getObjectReferences();
    expect(refs.length).toBe(2);

    const emp = refs[0];
    expect(emp.tokens.length).toBe(3);
    expect(emp.object.name).toBe(`EMPLOYEE`);
    expect(emp.object.schema).toBe(`CORPDATA`);
    expect(emp.alias).toBeUndefined();

    const proj = refs[1];
    expect(proj.tokens.length).toBe(3);
    expect(proj.object.name).toBe(`PROJECT`);
    expect(proj.object.schema).toBe(`CORPDATA`);
    expect(proj.alias).toBeUndefined();
  });

  test(`SELECT JOIN: left outer join`, () => {
    const query = [
      `SELECT EMPNO, LASTNAME, PROJNO`,
      `FROM CORPDATA.EMPLOYEE LEFT OUTER JOIN CORPDATA.PROJECT`,
      `      ON EMPNO = RESPEMP`,
      `WHERE LASTNAME > 'S'`,
    ].join(`\n`);

    const document = new Document(query);

    expect(document.statements.length).toBe(1);

    const statement = document.statements[0];

    const refs = statement.getObjectReferences();
    expect(refs.length).toBe(2);

    const emp = refs[0];
    expect(emp.tokens.length).toBe(3);
    expect(emp.object.name).toBe(`EMPLOYEE`);
    expect(emp.object.schema).toBe(`CORPDATA`);
    expect(emp.alias).toBeUndefined();

    const proj = refs[1];
    expect(proj.tokens.length).toBe(3);
    expect(proj.object.name).toBe(`PROJECT`);
    expect(proj.object.schema).toBe(`CORPDATA`);
    expect(proj.alias).toBeUndefined();
  });

  test(`SELECT JOIN: right outer join`, () => {
    const query = [
      `SELECT EMPNO, LASTNAME, PROJNO`,
      `FROM CORPDATA.PROJECT RIGHT OUTER JOIN CORPDATA.EMPLOYEE`,
      `      ON EMPNO = RESPEMP`,
      `WHERE LASTNAME > 'S';`,
    ].join(`\n`);

    const document = new Document(query);

    expect(document.statements.length).toBe(1);

    const statement = document.statements[0];

    const refs = statement.getObjectReferences();
    expect(refs.length).toBe(2);

    const proj = refs[0];
    expect(proj.tokens.length).toBe(3);
    expect(proj.object.name).toBe(`PROJECT`);
    expect(proj.object.schema).toBe(`CORPDATA`);
    expect(proj.alias).toBeUndefined();

    const emp = refs[1];
    expect(emp.tokens.length).toBe(3);
    expect(emp.object.name).toBe(`EMPLOYEE`);
    expect(emp.object.schema).toBe(`CORPDATA`);
    expect(emp.alias).toBeUndefined();
  });

  test(`SELECT JOIN: exception join`, () => {
    const query = [
      `SELECT EMPNO, LASTNAME, PROJNO`,
      `FROM CORPDATA.EMPLOYEE EXCEPTION JOIN PROJECT`,
      `      ON EMPNO = RESPEMP`,
      `WHERE LASTNAME > 'S'`,
    ].join(`\n`);

    const document = new Document(query);

    expect(document.statements.length).toBe(1);

    const statement = document.statements[0];

    const refs = statement.getObjectReferences();
    expect(refs.length).toBe(2);

    const emp = refs[0];
    expect(emp.tokens.length).toBe(3);
    expect(emp.object.name).toBe(`EMPLOYEE`);
    expect(emp.object.schema).toBe(`CORPDATA`);
    expect(emp.alias).toBeUndefined();

    const proj = refs[1];
    expect(proj.tokens.length).toBe(1);
    expect(proj.object.name).toBe(`PROJECT`);
    expect(proj.object.schema).toBeUndefined();
    expect(proj.alias).toBeUndefined();
  });

  test(`SELECT JOIN: cross join`, () => {
    const query = [
      `SELECT * FROM A CROSS JOIN B`,
    ].join(`\n`);

    const document = new Document(query);

    expect(document.statements.length).toBe(1);

    const statement = document.statements[0];

    const refs = statement.getObjectReferences();
    expect(refs.length).toBe(2);

    const A = refs[0];
    expect(A.tokens.length).toBe(1);
    expect(A.object.name).toBe(`A`);
    expect(A.object.schema).toBeUndefined;
    expect(A.alias).toBeUndefined();

    const B = refs[1];
    expect(B.tokens.length).toBe(1);
    expect(B.object.name).toBe(`B`);
    expect(B.object.schema).toBeUndefined();
    expect(B.alias).toBeUndefined();
  });

  test(`SELECT JOIN: full outer join`, () => {
    const query = [
      `SELECT EMPNO, LASTNAME, PROJNO`,
      `FROM EMPLOYEE as A FULL OUTER JOIN PROJECT b`,
      `      ON EMPNO = RESPEMP`,
      `WHERE LASTNAME > 'S'`,
    ].join(`\n`);

    const document = new Document(query);

    expect(document.statements.length).toBe(1);

    const statement = document.statements[0];

    const refs = statement.getObjectReferences();
    expect(refs.length).toBe(2);

    const emp = refs[0];
    expect(emp.tokens.length).toBe(3);
    expect(emp.object.name).toBe(`EMPLOYEE`);
    expect(emp.object.schema).toBeUndefined;
    expect(emp.alias).toBe(`A`);

    const proj = refs[1];
    expect(proj.tokens.length).toBe(2);
    expect(proj.object.name).toBe(`PROJECT`);
    expect(proj.object.schema).toBeUndefined;
    expect(proj.alias).toBe(`b`);
  });

  test(`INSERT: simple inserts`, () => {
    const content = [
      `insert into talks (user, content) values ('LINUX', 'Hello world, my talk birdtalk'), ('LINUX', 'This is another thing I did #hi');`,
      `insert into "myschema".hashtags (tag, base_talk) values('#hi', 2);`,
    ].join(`\r\n`);

    const document = new Document(content);

    expect(document.statements.length).toBe(2);

    const talksStatement = document.statements[0];
    const hashtagsStatement = document.statements[1];

    const refsA = talksStatement.getObjectReferences();
    expect(refsA.length).toBe(1);
    expect(refsA[0].tokens.length).toBe(1);
    expect(refsA[0].object.name).toBe(`talks`);
    expect(refsA[0].object.schema).toBeUndefined();

    const refsB = hashtagsStatement.getObjectReferences();
    expect(refsB.length).toBe(1);
    expect(refsB[0].tokens.length).toBe(3);
    expect(refsB[0].object.name).toBe(`hashtags`);
    expect(refsB[0].object.schema).toBe(`"myschema"`);
  });

  test(`DELETE: simple delete`, () => {
    const content = [
      `delete from talks where id > 2;`
    ].join(`\r\n`);

    const document = new Document(content);

    expect(document.statements.length).toBe(1);

    const talksStatement = document.statements[0];

    const refsA = talksStatement.getObjectReferences();
    expect(refsA.length).toBe(1);
    expect(refsA[0].tokens.length).toBe(1);
    expect(refsA[0].object.name).toBe(`talks`);
    expect(refsA[0].object.schema).toBeUndefined();
  });

  test(`CALL: simple unqualified`, () => {
    const content = [
      `call create_Sql_sample('MYNEWSCHEMA');`
    ].join(`\r\n`);

    const document = new Document(content);

    expect(document.statements.length).toBe(1);

    const talksStatement = document.statements[0];

    const refsA = talksStatement.getObjectReferences();
    expect(refsA.length).toBe(1);
    expect(refsA[0].tokens.length).toBe(1);
    expect(refsA[0].object.name).toBe(`create_Sql_sample`);
    expect(refsA[0].object.schema).toBeUndefined();
  });

  test(`CALL: simple qualified`, () => {
    const content = [
      `call "QSYS".create_Sql_sample('MYNEWSCHEMA');`
    ].join(`\r\n`);

    const document = new Document(content);

    expect(document.statements.length).toBe(1);

    const talksStatement = document.statements[0];

    const refsA = talksStatement.getObjectReferences();
    expect(refsA.length).toBe(1);
    expect(refsA[0].tokens.length).toBe(3);
    expect(refsA[0].object.name).toBe(`create_Sql_sample`);
    expect(refsA[0].object.schema).toBe(`"QSYS"`);
  });

  test(`ALTER: with reference`, () => {
    const content = [
      `ALTER TABLE DEPARTMENT`,
      `      ADD FOREIGN KEY RDE (MGRNO)`,
      `          REFERENCES EMPLOYEE`,
      `          ON DELETE SET NULL;`,
    ].join(`\n`);

    const document = new Document(content);

    expect(document.statements.length).toBe(1);
  
    const statement = document.statements[0];
    
    expect(statement.type).toBe(StatementType.Alter);

    const objs = statement.getObjectReferences();

    expect(objs.length).toBe(2);

    expect(objs[0].tokens.length).toBe(1);
    expect(objs[0].object.name).toBe(`DEPARTMENT`);
    expect(objs[0].object.schema).toBeUndefined();

    expect(objs[1].tokens.length).toBe(1);
    expect(objs[1].object.name).toBe(`EMPLOYEE`);
    expect(objs[1].object.schema).toBeUndefined();
  });

  test(`ALTER: with qualified reference`, () => {
    const content = [
      `ALTER TABLE myschema.dept`,
      `      ADD FOREIGN KEY RDE (MGRNO)`,
      `          REFERENCES myschema.emp`,
      `          ON DELETE SET NULL;`,
    ].join(`\n`);

    const document = new Document(content);

    expect(document.statements.length).toBe(1);
  
    const statement = document.statements[0];

    expect(statement.type).toBe(StatementType.Alter);

    const objs = statement.getObjectReferences();

    expect(objs.length).toBe(2);

    expect(objs[0].tokens.length).toBe(3);
    expect(objs[0].object.name).toBe(`dept`);
    expect(objs[0].object.schema).toBe(`myschema`);

    expect(objs[1].tokens.length).toBe(3);
    expect(objs[1].object.name).toBe(`emp`);
    expect(objs[1].object.schema).toBe(`myschema`);
  });

  test(`CREATE INDEX: with and without UNIQUE`, () => {
    const content = [
      `CREATE UNIQUE INDEX XDEPT1`,
      `       ON DEPARTMENT (DEPTNO);`,
      ``,
      `CREATE INDEX XDEPT2`,
      `       ON DEPARTMENT (MGRNO);`,
    ].join(`\r\n`);

    const document = new Document(content);

    expect(document.statements.length).toBe(2);
  
    const withUnique = document.statements[0];
    const withoutUnique = document.statements[1];

    expect(withUnique.type).toBe(StatementType.Create);
    expect(withoutUnique.type).toBe(StatementType.Create);

    const refsA = withUnique.getObjectReferences();
    const refsB = withoutUnique.getObjectReferences();

    expect(refsA.length).toBe(2);
    expect(refsA[0].tokens.length).toBe(1);
    expect(refsA[0].type).toBe(`INDEX`);
    expect(refsA[0].object.name).toBe(`XDEPT1`);
    expect(refsA[0].object.schema).toBeUndefined();

    expect(refsA[1].tokens.length).toBe(1);
    expect(refsA[1].type).toBeUndefined();
    expect(refsA[1].object.name).toBe(`DEPARTMENT`);
    expect(refsA[1].object.schema).toBeUndefined();

    expect(refsB.length).toBe(2);
    expect(refsB[0].tokens.length).toBe(1);
    expect(refsB[0].type).toBe(`INDEX`);
    expect(refsB[0].object.name).toBe(`XDEPT2`);
    expect(refsB[0].object.schema).toBeUndefined();

    expect(refsB[1].tokens.length).toBe(1);
    expect(refsB[1].type).toBeUndefined();
    expect(refsB[1].object.name).toBe(`DEPARTMENT`);
    expect(refsB[1].object.schema).toBeUndefined();
  });

  test(`CREATE INDEX: with and without UNIQUE, but qualified`, () => {
    const content = [
      `CREATE UNIQUE INDEX myschema.XDEPT1`,
      `       ON other.DEPARTMENT (DEPTNO);`,
      ``,
      `CREATE INDEX myschema.XDEPT2`,
      `       ON other.DEPARTMENT (MGRNO);`,
    ].join(`\r\n`);

    const document = new Document(content);

    expect(document.statements.length).toBe(2);
  
    const withUnique = document.statements[0];
    const withoutUnique = document.statements[1];

    expect(withUnique.type).toBe(StatementType.Create);
    expect(withoutUnique.type).toBe(StatementType.Create);

    const refsA = withUnique.getObjectReferences();
    const refsB = withoutUnique.getObjectReferences();

    expect(refsA.length).toBe(2);
    expect(refsA[0].tokens.length).toBe(3);
    expect(refsA[0].type).toBe(`INDEX`);
    expect(refsA[0].object.name).toBe(`XDEPT1`);
    expect(refsA[0].object.schema).toBe(`myschema`);

    expect(refsA[1].tokens.length).toBe(3);
    expect(refsA[1].type).toBeUndefined();
    expect(refsA[1].object.name).toBe(`DEPARTMENT`);
    expect(refsA[1].object.schema).toBe(`other`);

    expect(refsB.length).toBe(2);
    expect(refsB[0].tokens.length).toBe(3);
    expect(refsB[0].type).toBe(`INDEX`);
    expect(refsB[0].object.name).toBe(`XDEPT2`);
    expect(refsB[0].object.schema).toBe(`myschema`);

    expect(refsB[1].tokens.length).toBe(3);
    expect(refsB[1].type).toBeUndefined();
    expect(refsB[1].object.name).toBe(`DEPARTMENT`);
    expect(refsB[1].object.schema).toBe(`other`);
  });

  test(`CREATE ALIAS`, () => {
    const content = [
      `create or replace view tagtalk as (`,
      `  select b.*, a.tag`,
      `    from hashtags as a`,
      `    left join talks as b`,
      `      on a.base_talk = b.t_id`,
      `);`,
    ].join(`\n`);

    const document = new Document(content);

    expect(document.statements.length).toBe(1);
  
    const view = document.statements[0];

    expect(view.type).toBe(StatementType.Create);

    const defs = view.getObjectReferences();

    expect(defs.length).toBe(3);

    expect(defs[0].type).toBe(`view`);
    expect(defs[0].object.name).toBe(`tagtalk`);
    expect(defs[0].object.schema).toBeUndefined();
    expect(defs[0].alias).toBeUndefined();

    expect(defs[1].type).toBeUndefined();
    expect(defs[1].object.name).toBe(`hashtags`);
    expect(defs[1].object.schema).toBeUndefined();
    expect(defs[1].alias).toBe(`a`);

    expect(defs[2].type).toBeUndefined();
    expect(defs[2].object.name).toBe(`talks`);
    expect(defs[2].object.schema).toBeUndefined();
    expect(defs[2].alias).toBe(`b`);
  })
});

describe(`Offset reference tests`, () => {
  test(`Writing select`, () => {
    const document = new Document(`select * from sample.;`);

    expect(document.statements.length).toBe(1);
  
    const statement = document.statements[0];
  
    const ref = statement.getReferenceByOffset(21);
    expect(ref).toBeDefined();
    expect(ref.object.schema).toBe(`sample`);
    expect(ref.object.name).toBeUndefined();
  });

  test(`Writing select, invalid middle`, () => {
    const document = new Document(`select b. from department b;`);

    expect(document.statements.length).toBe(1);
  
    const statement = document.statements[0];

    const objs = statement.getObjectReferences();
    expect(objs.length).toBe(1);
    expect(objs[0].object.schema).toBeUndefined();
    expect(objs[0].object.name).toBe(`department`);
    expect(objs[0].alias).toBe(`b`);
  
    const ref = statement.getReferenceByOffset(9);
    expect(ref).toBeDefined();
    expect(ref.object.schema).toBe(`b`);
    expect(ref.object.name).toBeUndefined();
  });
});

describe(`PL body tests`, () => {
  test(`CREATE PROCEDURE: with body`, () => {
    const lines = [
      `CREATE PROCEDURE MEDIAN_RESULT_SET (OUT medianSalary DECIMAL(7,2))`,
      `LANGUAGE SQL `,
      `DYNAMIC RESULT SETS 1`,
      `BEGIN `,
      `  DECLARE v_numRecords INTEGER DEFAULT 1;`,
      `  DECLARE v_counter INTEGER DEFAULT 0;`,
      `  DECLARE c1 CURSOR FOR `,
      `    SELECT salary `,
      `        FROM staff `,
      `        ORDER BY salary;`,
      `  DECLARE c2 CURSOR WITH RETURN FOR `,
      `    SELECT name, job, salary `,
      `        FROM staff `,
      `        WHERE salary > medianSalary`,
      `        ORDER BY salary;`,
      `  DECLARE EXIT HANDLER FOR NOT FOUND`,
      `    SET medianSalary = 6666; `,
      `  SET medianSalary = 0;`,
      `  SELECT COUNT(*) INTO v_numRecords FROM STAFF;`,
      `  OPEN c1;`,
      `  WHILE v_counter < (v_numRecords / 2 + 1) `,
      `    DO FETCH c1 INTO medianSalary;`,
      `    SET v_counter = v_counter + 1;`,
      `  END WHILE;`,
      `  CLOSE c1;`,
      `  OPEN c2;`,
      `END`,
    ].join(`\r\n`);

    const document = new Document(lines);
    const statements = document.statements;

    const medianResultSetProc = statements[0];
    expect(medianResultSetProc.type).toBe(StatementType.Create);
    expect(medianResultSetProc.isBlockOpener()).toBe(true);

    const numRecordsDeclare = statements[1];
    expect(numRecordsDeclare.type).toBe(StatementType.Declare);

    const endStatement = statements[statements.length-1];
    expect(endStatement.type).toBe(StatementType.End);

    const endStatements = statements.filter(stmt => stmt.type === StatementType.End);
    expect(endStatements.length).toBe(2);

    // END WHILE
    expect(endStatements[0].tokens.length).toBe(2);

    // END
    expect(endStatements[1].tokens.length).toBe(1);
  });

  test(`CREATE PROCEDURE followed by CALL statement`, () => {
    const lines = [
      `CREATE PROCEDURE MEDIAN_RESULT_SET (OUT medianSalary DECIMAL(7,2))`,
      `LANGUAGE SQL `,
      `DYNAMIC RESULT SETS 1`,
      `BEGIN `,
      `  DECLARE v_numRecords INTEGER DEFAULT 1;`,
      `  DECLARE v_counter INTEGER DEFAULT 0;`,
      `  DECLARE c1 CURSOR FOR `,
      `    SELECT salary `,
      `        FROM staff `,
      `        ORDER BY salary;`,
      `  DECLARE c2 CURSOR WITH RETURN FOR `,
      `    SELECT name, job, salary `,
      `        FROM staff `,
      `        WHERE salary > medianSalary`,
      `        ORDER BY salary;`,
      `  DECLARE EXIT HANDLER FOR NOT FOUND`,
      `    SET medianSalary = 6666; `,
      `  SET medianSalary = 0;`,
      `  SELECT COUNT(*) INTO v_numRecords FROM STAFF;`,
      `  OPEN c1;`,
      `  WHILE v_counter < (v_numRecords / 2 + 1) `,
      `    DO FETCH c1 INTO medianSalary;`,
      `    SET v_counter = v_counter + 1;`,
      `  END WHILE;`,
      `  CLOSE c1;`,
      `  OPEN c2;`,
      `END;`,
      ``,
      `CALL MEDIAN_RESULT_SET(12345.55);`,
    ].join(`\r\n`);

    const document = new Document(lines);
    const statements = document.statements;

    const medianResultSetProc = statements[0];
    expect(medianResultSetProc.type).toBe(StatementType.Create);
    expect(medianResultSetProc.isBlockOpener()).toBe(true);

    const numRecordsDeclare = statements[1];
    expect(numRecordsDeclare.type).toBe(StatementType.Declare);

    const endStatement = statements[statements.length-2];
    expect(endStatement.type).toBe(StatementType.End);

    const callStatement = statements[statements.length-1];
    expect(callStatement.type).toBe(StatementType.Call);
    expect(callStatement.isBlockOpener()).toBe(false);
  });
});